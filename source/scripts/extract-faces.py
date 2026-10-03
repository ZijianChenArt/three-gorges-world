#!/usr/bin/env python3
"""Sample real GLB face triangles for sparse solid-plane artwork accents.

No hulls, new caps, remeshing, or merged triangles are generated.
"""
import hashlib, json, math, struct
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/models/three-gorges.glb'
WIRES=ROOT/'public/models/sculpture-wireframes.json'
OUTPUT=ROOT/'public/models/sculpture-faces.json'
blob=SOURCE.read_bytes();source_hash=hashlib.sha256(blob).hexdigest()
wire_blob=WIRES.read_bytes();wire=json.loads(wire_blob)
assert source_hash==wire['sourceSHA256']
magic,version,total=struct.unpack_from('<4sII',blob)
assert (magic,version,total)==(b'glTF',2,len(blob))
length=struct.unpack_from('<I',blob,12)[0]
doc=json.loads(blob[20:20+length]);binary_offset=20+length+8
DTYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def accessor(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    dtype=np.dtype(DTYPES[a['componentType']]);width=WIDTH[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=blob,
        offset=binary_offset+v.get('byteOffset',0)+a.get('byteOffset',0),
        strides=(v.get('byteStride',dtype.itemsize*width),dtype.itemsize)).copy()

def transform(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1]);m=np.eye(4)
    m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(node.get('scale',[1,1,1]))
    m[:3,3]=node.get('translation',[0,0,0]);return m

def parts(index,parent=np.eye(4)):
    node=doc['nodes'][index];world=parent@transform(node)
    if 'mesh' in node:
        for pi,p in enumerate(doc['meshes'][node['mesh']]['primitives']):
            assert p.get('mode',4)==4
            vertices=accessor(p['attributes']['POSITION']).astype(float)
            positions=(np.c_[vertices,np.ones(len(vertices))]@world.T)[:,:3]
            indices=accessor(p['indices']).reshape(-1,3)
            yield {'node':index,'mesh':node['mesh'],'primitive':pi,'triangles':positions[indices]}
    for child in node.get('children',[]):yield from parts(child,world)

def allocate(weights,capacities,budget):
    """Balanced per-material budgets prevent tiny parts from disappearing."""
    allocation=np.minimum(np.array(capacities),24)
    remaining=budget-int(allocation.sum())
    while remaining:
        eligible=allocation<capacities
        # Highest weighted unmet quota, with stable index tie breaking.
        score=np.where(eligible,weights/(allocation+1),-1)
        at=int(np.argmax(score));assert score[at]>=0
        allocation[at]+=1;remaining-=1
    return allocation

roots={doc['nodes'][i]['name']:i for i in doc['scenes'][doc.get('scene',0)]['nodes']}
origin=np.array(wire['sceneOriginOriginal']);scale=wire['sceneScale']
groups=[];report=[];selection_records=[]
for group in wire['groups']:
    source_parts=list(parts(roots[group['sourceGroup']]))
    areas=[];capacity=[];weights=[]
    for part in source_parts:
        t=part['triangles'];area=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)/2
        areas.append(area);capacity.append(int(np.count_nonzero(area>1e-10)))
        weights.append(math.sqrt(float(area.sum())))
    quota=allocate(np.array(weights),np.array(capacity),400)
    selected=[];records=[]
    for at,(part,area,count) in enumerate(zip(source_parts,areas,quota)):
        seed=int.from_bytes(hashlib.sha256((group['id']+':'+str(at)).encode()).digest()[:8],'little')
        rng=np.random.default_rng(seed)
        valid=np.flatnonzero(area>1e-10)
        # Weighted sampling without replacement. Broad actual face surfaces
        # receive greater weight than tiny rounded-bevel triangles.
        keys=-np.log(np.maximum(rng.random(len(valid)),1e-14))/np.sqrt(area[valid])
        chosen=np.sort(valid[np.argsort(keys,kind='stable')[:int(count)]])
        for face_index in chosen:
            original=part['triangles'][face_index]
            local=(original-origin)*scale-np.array(group['center'])
            quantized=np.round(local,5)
            assert np.linalg.norm(np.cross(quantized[1]-quantized[0],quantized[2]-quantized[0]))>1e-10
            # Every output triangle is the transformed/rounded original face.
            assert np.array_equal(quantized,np.round((original-origin)*scale-group['center'],5))
            selected.append(quantized)
            records.append([part['mesh'],part['primitive'],int(face_index)])
    selected=np.array(selected);assert len(selected)==400
    assert len({tuple(x) for x in records})==400
    world=selected+group['center'];low=np.array(group['bounds']['min']);high=np.array(group['bounds']['max'])
    assert np.isfinite(selected).all() and (world>=low-1e-4).all() and (world<=high+1e-4).all()
    groups.append({k:group[k] for k in ['id','name','sourceGroup','center','bounds','scale']}|
        {'faceCount':len(selected),'triangles':selected.reshape(-1).tolist()})
    report.append({'id':group['id'],'sourceFaces':sum(len(p['triangles']) for p in source_parts),
        'sampledFaces':len(selected),'sourceMeshParts':len(source_parts),'partBudgets':quota.tolist(),
        'selectionSHA256':hashlib.sha256(json.dumps(records,separators=(',',':')).encode()).hexdigest()})
    selection_records.append(records)

payload={k:wire[k] for k in ['version','coordinateSystem','sceneOriginOriginal','sceneScale','sceneBounds','source','sourceSHA256']}
payload.update(normalization='Matches sculpture-wireframes.json. Face vertices are local to each sculpture bottom-center. Add group.center for the original normalized scene arrangement.',
    sampling='400 deterministic area-weighted original triangles per group, balanced across original material mesh parts. Sparse accents only; not a complete surface. No hull, invented caps or remeshing.',groups=groups)
encoded=json.dumps(payload,separators=(',',':')).encode();assert len(encoded)<300000
assert SOURCE.read_bytes()==blob and WIRES.read_bytes()==wire_blob
OUTPUT.write_bytes(encoded)
summary={'source':'public/models/three-gorges.glb','output':'public/models/sculpture-faces.json','bytes':len(encoded),'faceCount':sum(g['faceCount'] for g in groups),'groups':report,
    'checks':['Source SHA256 matches the wireframe asset','All five original group identities retained','2000 actual original source triangles; no invented faces','Unique source triangle IDs in each group','Same origin/scale/bottom-center normalization as edges','Five-decimal coordinate rounding','No nonfinite or degenerate triangles','All triangles within original group bounds','GLB and wireframe JSON left byte-identical','Compact output under 300KB'],'validated':True}
(ROOT/'scripts/face-extraction-report.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
