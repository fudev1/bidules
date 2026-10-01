# Écrit un GIF animé à partir d'images 64 x 64 (listes de lettres de palette). Python 3 sans dépendance.
import struct

BG = (243, 238, 246)
GROUND = (222, 210, 232)


def lzw(indices, mcs):
    clear, eoi = 1 << mcs, (1 << mcs) + 1
    table = {(i,): i for i in range(clear)}
    nxt, size = eoi + 1, mcs + 1
    out, buf, cnt = bytearray(), 0, 0

    def emit(code, bits):
        nonlocal buf, cnt
        buf |= code << cnt
        cnt += bits
        while cnt >= 8:
            out.append(buf & 255)
            buf >>= 8
            cnt -= 8

    emit(clear, size)
    cur = ()
    for p in indices:
        nc = cur + (p,)
        if nc in table:
            cur = nc
            continue
        emit(table[cur], size)
        table[nc] = nxt
        nxt += 1
        if nxt > (1 << size) and size < 12:
            size += 1
        if nxt >= 4095:
            emit(clear, size)
            table = {(i,): i for i in range(clear)}
            nxt, size = eoi + 1, mcs + 1
        cur = (p,)
    emit(table[cur], size)
    emit(eoi, size)
    if cnt:
        out.append(buf & 255)
    return bytes(out)


def blocks(data):
    out = bytearray()
    for i in range(0, len(data), 255):
        chunk = data[i:i + 255]
        out.append(len(chunk))
        out += chunk
    out.append(0)
    return bytes(out)


def write_gif(path, imgs, delays_cs, scale=4, ground_row=61):
    """imgs : liste de grilles de couleurs RVB (ou None pour le fond), 64 x 64"""
    n = len(imgs[0])
    colors = {BG: 0, GROUND: 1}
    for g in imgs:
        for row in g:
            for c in row:
                if c is not None and c not in colors:
                    colors[c] = len(colors)
    mcs = max(2, (len(colors) - 1).bit_length())
    table = [c for c, _ in sorted(colors.items(), key=lambda kv: kv[1])]
    table += [(0, 0, 0)] * ((1 << mcs) - len(table))
    w = h = n * scale
    out = bytearray(b"GIF89a" + struct.pack("<HHBBB", w, h, 0x80 | (mcs - 1), 0, 0))
    for c in table:
        out += bytes(c)
    out += b"\x21\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00"
    for g, d in zip(imgs, delays_cs):
        out += b"\x21\xf9\x04\x04" + struct.pack("<HBB", max(2, d), 0, 0)
        out += b"\x2c" + struct.pack("<HHHHB", 0, 0, w, h, 0)
        out += bytes([mcs])
        idx = bytearray()
        for y in range(h):
            row = g[y // scale]
            line = bytearray()
            for x in range(w):
                c = row[x // scale]
                line.append(colors[c] if c is not None else (1 if y // scale == ground_row else 0))
            idx += line
        out += blocks(lzw(bytes(idx), mcs))
    out += b"\x3b"
    with open(path, "wb") as f:
        f.write(out)
