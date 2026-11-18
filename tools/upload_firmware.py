"""Copia el firmware a la flash del ESP32 (raw REPL) y, si se pide, lo reinicia.

Uso (desde la raíz del repo):
    python tools/upload_firmware.py [--port COM6] [--reset]

Sube: main.py, config.py, clock.py, net.py, cloud.py, alarms.py.
No sube hw_test.py ni config.example.py. Cierra PyCharm si tiene el puerto abierto.
"""
import argparse
import hashlib
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_on_board import open_port, enter_raw_repl, run  # noqa: E402

FIRMWARE = Path(__file__).resolve().parent.parent / "firmware"
FILES = ["config.py", "clock.py", "net.py", "cloud.py", "alarms.py", "main.py"]


def write_file(s, name, data):
    lines = ["f=open(%r,'wb')" % name]
    for i in range(0, len(data), 200):
        lines.append("f.write(%r)" % data[i:i + 200])
    lines.append("f.close()")
    # Verificación: SHA-1 calculado en la placa
    lines.append("import hashlib,binascii")
    lines.append("h=hashlib.sha1()")
    lines.append("f=open(%r,'rb')" % name)
    lines.append("h.update(f.read())")
    lines.append("f.close()")
    lines.append("print(binascii.hexlify(h.digest()).decode())")
    out, err = run(s, ("\n".join(lines)).encode(), timeout=30)
    if err.strip():
        raise RuntimeError(err.decode("utf-8", "replace"))
    return out.decode().strip().splitlines()[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="COM6")
    ap.add_argument("--reset", action="store_true", help="reiniciar la placa al terminar para que arranque main.py")
    args = ap.parse_args()

    missing = [f for f in FILES if not (FIRMWARE / f).exists()]
    if missing:
        sys.exit("Faltan archivos en firmware/: %s (copia config.example.py como config.py)" % ", ".join(missing))

    s = open_port(args.port)
    try:
        enter_raw_repl(s)
        for name in FILES:
            data = (FIRMWARE / name).read_bytes()
            sha_board = write_file(s, name, data)
            sha_local = hashlib.sha1(data).hexdigest()
            status = "OK" if sha_board == sha_local else "DIFERENTE"
            print("  %-10s %6d bytes  %s" % (name, len(data), status))
            if status != "OK":
                sys.exit("La copia de %s no coincide. Reintenta." % name)
        if args.reset:
            print("Reiniciando la placa...")
            s.write(b"import machine\r\nmachine.reset()\r\n\x04")
            time.sleep(0.3)
    finally:
        try:
            s.write(b"\x02")
        except Exception:
            pass
        s.close()
    print("Listo.")


if __name__ == "__main__":
    main()
