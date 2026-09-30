import zlib, struct
def read(p):
    b=open(p,"rb").read(); w,h=struct.unpack(">II",b[16:24]); i=8; idat=b""
    while i<len(b):
        l=struct.unpack(">I",b[i:i+4])[0]; t=b[i+4:i+8]
        if t==b"IDAT": idat+=b[i+8:i+8+l]
        i+=12+l
    raw=zlib.decompress(idat); st=w*4; rows=[]; prev=bytearray(st); o=0
    for y in range(h):
        f=raw[o]; line=bytearray(raw[o+1:o+1+st]); o+=1+st
        for x in range(st):
            a=line[x-4] if x>=4 else 0; up=prev[x]; c=prev[x-4] if x>=4 else 0
            if f==1: line[x]=(line[x]+a)&255
            elif f==2: line[x]=(line[x]+up)&255
            elif f==3: line[x]=(line[x]+((a+up)>>1))&255
            elif f==4:
                pa,pb,pc=abs(up-c),abs(a-c),abs(a+up-2*c); line[x]=(line[x]+(a if pa<=pb and pa<=pc else (up if pb<=pc else c)))&255
        rows.append(line); prev=line
    return w,h,[[tuple(r[x*4:x*4+4]) for x in range(w)] for r in rows]
def write(p, px):
    h=len(px); w=len(px[0])
    raw=b"".join(b"\x00"+b"".join(bytes(c) for c in row) for row in px)
    ch=lambda t,d: struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    open(p,"wb").write(b"\x89PNG\r\n\x1a\n"+ch(b"IHDR",struct.pack(">IIBBBBB",w,h,8,6,0,0,0))+ch(b"IDAT",zlib.compress(raw,9))+ch(b"IEND",b""))
def frames(p):
    w,h,px=read(p); return [[row[k*64:(k+1)*64] for row in px] for k in range(w//64)]
