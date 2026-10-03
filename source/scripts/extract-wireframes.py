#!/usr/bin/env python3
"""Extract mobile-friendly crease/boundary wireframes from the original GLB."""
import json, struct, math, hashlib
from collections import defaultdict
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/models/three-gorges.glb'
TARGET=ROOT/'public/models/sculpture-wireframes.json'
blob=SOURCE.read_bytes()
magic,version,total=struct.unpack_from('<4sII',blob)
assert magic==b'glTF' and version==2 and total==len(blob)
jsize=struct.unpack_from('<I',blob,12)[0]
doc=json.loads(blob[20:20+jsize]);binary_offset=20+jsize+8
DTYPES={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def accessor(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    dtype=np.dtype(DTYPES[a['componentType']]);width=WIDTH[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=blob,
        offset=binary_offset+v.get('byteOffset',0)+a.get('byteOffset',0),
        strides=(v.get('byteStride',dtype.itemsize*width),dtype.itemsize)).copy()

def matrix(node):
    if 'matrix' in node:return np.array(node['matrix'],dtype=float).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1]);s=node.get('scale',[1,1,1])
    m=np.eye(4)
    m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(s)
    m[:3,3]=node.get('translation',[0,0,0]);return m

def meshes(index,parent=np.eye(4)):
    node=doc['nodes'][index];world=parent@matrix(node)
    if 'mesh' in node:
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            assert primitive.get('mode',4)==4
            p=accessor(primitive['attributes']['POSITION']).astype(float)
            p=np.c_[p,np.ones(len(p))]@world.T
            faces=accessor(primitive['indices']).reshape(-1,3)
            yield p[:,:3],faces
    for child in node.get('children',[]):yield from meshes(child,world)

def rdp(points,eps):
    if len(points)<=2:return [0,len(points)-1]
    a,b=points[0],points[-1];ab=b-a;den=float(ab@ab)
    if den<1e-20:dist=np.linalg.norm(points-a,axis=1)
    else:
        t=np.clip(((points-a)@ab)/den,0,1)
        dist=np.linalg.norm(points-(a+t[:,None]*ab),axis=1)
    at=int(np.argmax(dist))
    if dist[at]<=eps:return [0,len(points)-1]
    left=rdp(points[:at+1],eps);right=rdp(points[at:],eps)
    return left[:-1]+[at+i for i in right]

def simplify_graph(points,edges,eps):
    """RDP only nonbranching chains. Junctions and hard corners remain protected."""
    adj=defaultdict(set)
    for a,b in edges:adj[a].add(b);adj[b].add(a)
    seen=set();out=[]
    def edge(a,b):return (min(a,b),max(a,b))
    def walk(a,b):
        chain=[a,b];seen.add(edge(a,b))
        while len(adj[b])==2:
            c=next(v for v in adj[b] if v!=a)
            if edge(b,c) in seen:break
            chain.append(c);seen.add(edge(b,c));a,b=b,c
            if c==chain[0]:break
        return chain
    chains=[]
    for a in adj:
        if len(adj[a])!=2:
            for b in adj[a]:
                if edge(a,b) not in seen:chains.append(walk(a,b))
    for a,b in edges:
        if edge(a,b) not in seen:chains.append(walk(a,b))
    for chain in chains:
        pts=points[chain]
        if len(chain)>3 and chain[0]==chain[-1]:
            mid=len(chain)//2
            ids=rdp(pts[:mid+1],eps)[:-1]+[mid+i for i in rdp(pts[mid:],eps)]
        else:ids=rdp(pts,eps)
        for a,b in zip(ids,ids[1:]):
            u,v=chain[a],chain[b]
            if u!=v:out.append(edge(u,v))
    return sorted(set(out))

roots=doc['scenes'][doc.get('scene',0)]['nodes']
groups=[];reports=[]
scene_points=np.concatenate([v for root in roots for v,f in meshes(root)])
scene_min=scene_points.min(0);scene_max=scene_points.max(0)
scene_origin=(scene_min+scene_max)/2;scene_origin[1]=scene_min[1]
scene_scale=22/float((scene_max-scene_min).max())
titles={'01_MEMORY_APERTURE':'Memory Aperture','02_RESONANCE_GARDEN':'Resonance Garden','03_DATA_CLOUD':'Data Cloud','04_ECHO_CHAMBER':'Echo Chamber','05_PHASE_BLOOM':'Phase Bloom'}
for root in roots:
    name=doc['nodes'][root]['name'];assert name in titles
    lookup={};points=[];edge_normals=defaultdict(list);triangles=0
    for verts,faces in meshes(root):
        ids=[]
        for v in verts:
            key=tuple(np.round(v,5));idx=lookup.get(key)
            if idx is None:idx=len(points);lookup[key]=idx;points.append(v)
            ids.append(idx)
        for face in faces:
            a,b,c=[ids[i] for i in face]
            if len({a,b,c})!=3:continue
            normal=np.cross(np.array(points[b])-points[a],np.array(points[c])-points[a]);n=np.linalg.norm(normal)
            if n<1e-10:continue
            normal/=n;triangles+=1
            for u,v in [(a,b),(b,c),(c,a)]:edge_normals[(min(u,v),max(u,v))].append(normal)
    points=np.array(points);mn=points.min(0);mx=points.max(0);center=(mn+mx)/2;scale=2/float((mx-mn).max());local=(points-center)*scale
    crease=math.cos(math.radians(18));edges=[];coplanar=0
    for edge,normals in edge_normals.items():
        keep=len(normals)==1 or any(abs(float(a@b))<crease for i,a in enumerate(normals) for b in normals[i+1:])
        if not keep:coplanar+=1;continue
        a,b=edge
        if np.linalg.norm(local[a]-local[b])<.005:continue
        edges.append(edge)
    before=len(edges)
    if name=='03_DATA_CLOUD':
        # Collapse tiny bevel corner clusters and subpixel wire thickness only.
        # This retains voxel orientation and full sculpture proportions.
        from scipy.spatial import cKDTree
        parents=list(range(len(local)))
        def find(i):
            while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
            return i
        for a,b in cKDTree(local).query_pairs(.014):
            ra,rb=find(a),find(b)
            if ra!=rb:parents[rb]=ra
        buckets=defaultdict(list)
        for i in range(len(local)):buckets[find(i)].append(i)
        new_points=[];remap={}
        for values in buckets.values():
            at=len(new_points);new_points.append(local[values].mean(0))
            for old in values:remap[old]=at
        local=np.array(new_points);points=local/scale+center
        edges=sorted(set((min(remap[a],remap[b]),max(remap[a],remap[b])) for a,b in edges if remap[a]!=remap[b]))
        edges=[(a,b) for a,b in edges if np.linalg.norm(local[a]-local[b])>=.005]
    edges=simplify_graph(local,edges,.0075)
    # Deterministic rounded flat segment buffer avoids verbose per-segment objects.
    bottom_center=center.copy();bottom_center[1]=mn[1]
    render_local=(points-bottom_center)*scene_scale
    normalized_center=(bottom_center-scene_origin)*scene_scale
    normalized_min=(mn-scene_origin)*scene_scale;normalized_max=(mx-scene_origin)*scene_scale
    flat=[round(float(v),5) for a,b in edges for p in [render_local[a],render_local[b]] for v in p]
    assert len(flat)%6==0 and all(math.isfinite(v) and abs(v)<=22.00001 for v in flat)
    groups.append({'id':name.split('_',1)[1].lower(),'name':titles[name],'sourceGroup':name,'center':[round(float(v),5) for v in normalized_center],
        'bounds':{'min':[round(float(v),5) for v in normalized_min],'max':[round(float(v),5) for v in normalized_max]},'scale':round(scene_scale,10),'edges':flat,'edgeCount':len(edges)})
    reports.append({'name':name,'sourceTriangles':triangles,'uniqueVertices':len(points),'allEdges':len(edge_normals),'coplanarOrSmoothEdgesOmitted':coplanar,'featureEdgesBeforeSimplification':before,'outputEdges':len(edges)})
payload={'version':1,'coordinateSystem':'right-handed glTF Y-up','normalization':'Whole scene uniformly scaled to longest extent 22. Each edges array is local to sculpture bottom-center. Add group.center to each edge point for normalized scene coordinates.',
    'sceneOriginOriginal':[round(float(v),5) for v in scene_origin],'sceneScale':round(scene_scale,10),'sceneBounds':{'min':[round(float(v),5) for v in (scene_min-scene_origin)*scene_scale],'max':[round(float(v),5) for v in (scene_max-scene_origin)*scene_scale]},'source':'three-gorges.glb','sourceSHA256':hashlib.sha256(blob).hexdigest(),'creaseAngleDegrees':18,'groups':groups}
assert len(groups)==5
for group in groups:
    arr=np.array(group['edges']).reshape(-1,2,3)
    assert len(arr)==group['edgeCount'] and len(arr)<=1500
    assert np.isfinite(arr).all() and (np.linalg.norm(arr[:,1]-arr[:,0],axis=1)>1e-6).all()
    world=arr+group['center'];low=np.array(group['bounds']['min']);high=np.array(group['bounds']['max'])
    assert (world>=low-1e-4).all() and (world<=high+1e-4).all()
assert abs(float(((scene_max-scene_min)*scene_scale).max())-22)<1e-4
TARGET.write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
report={'source':str(SOURCE.relative_to(ROOT)),'output':str(TARGET.relative_to(ROOT)),'bytes':TARGET.stat().st_size,'groups':reports,'totalEdges':sum(g['edgeCount'] for g in groups),'tests':['Five original named groups preserved','glTF v2 header/length valid','Transforms applied including group translations','Coplanar and smooth triangle edges omitted','All normalized coordinates finite and within global extent 22; group origins bottom-centered','Every flat edge buffer divisible by 6','No zero-length output edges'],'validated':True}
(ROOT/'scripts/wireframe-extraction-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
