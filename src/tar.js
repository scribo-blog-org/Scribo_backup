function octal(value, width) {
    const body = value.toString(8)
    return body.padStart(width - 1, "0") + "\0"
}

function tarHeader(name, size) {
    const header = Buffer.alloc(512)
    header.write(name, 0, Math.min(name.length, 99), "utf8")
    header.write(octal(0o644, 8), 100, 8, "utf8")
    header.write(octal(0, 8), 108, 8, "utf8")
    header.write(octal(0, 8), 116, 8, "utf8")
    header.write(octal(size, 12), 124, 12, "utf8")
    header.write(octal(Math.floor(Date.now() / 1000), 12), 136, 12, "utf8")
    header.write(" ".repeat(8), 148, 8, "utf8")
    header.write("0", 156, 1, "utf8")
    header.write("ustar\0", 257, 6, "utf8")
    header.write("00", 263, 2, "utf8")

    let sum = 0
    for (const byte of header) {
        sum += byte
    }
    header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf8")
    return header
}

function tarFile(name, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const padding = (512 - (buffer.length % 512)) % 512
    return Buffer.concat([
        tarHeader(name, buffer.length),
        buffer,
        Buffer.alloc(padding)
    ])
}

function packTar(files) {
    const parts = files.map((file) => tarFile(file.name, file.data))
    parts.push(Buffer.alloc(1024))
    return Buffer.concat(parts)
}

module.exports = { packTar }
