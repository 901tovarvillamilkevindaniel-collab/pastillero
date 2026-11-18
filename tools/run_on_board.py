"""Corre un script .py en el ESP32 sin guardarlo en la flash (raw REPL).

Uso:
    python tools/run_on_board.py firmware/hw_test.py [--port COM6] [--timeout 60]

Necesita pyserial, que ya viene instalado con esptool.
Cierra PyCharm/Arduino IDE si tienen el puerto abierto: solo un programa puede usarlo.
"""
import argparse
import sys
import time

import serial


def open_port(port):
    s = serial.Serial()
    s.port = port
    s.baudrate = 115200
    s.timeout = 0.1
    s.dtr = False  # no reiniciar la placa al abrir el puerto
    s.rts = False
    try:
        s.open()
    except serial.SerialException as e:
        sys.exit(f"No pude abrir {port}: {e}\n¿Está abierto en PyCharm, Arduino IDE u otra terminal?")
    return s


def read_until(s, marker, timeout):
    buf = b""
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        chunk = s.read(s.in_waiting or 1)
        if chunk:
            buf += chunk
            if buf.endswith(marker):
                return buf
    raise TimeoutError(f"No llegó {marker!r} a tiempo. Recibido: {buf[-200:]!r}")


def enter_raw_repl(s):
    s.write(b"\r\x03\x03")  # Ctrl-C dos veces: parar lo que esté corriendo
    time.sleep(0.3)
    s.reset_input_buffer()
    s.write(b"\x01")  # Ctrl-A: modo raw REPL
    read_until(s, b"raw REPL; CTRL-B to exit\r\n>", 5)


def run(s, code, timeout):
    for i in range(0, len(code), 256):  # en trozos para no desbordar el buffer USB
        s.write(code[i:i + 256])
        time.sleep(0.01)
    s.write(b"\x04")  # Ctrl-D: ejecutar
    read_until(s, b"OK", 5)

    # Salida normal hasta \x04, luego errores hasta \x04>
    out_err = [b"", b""]
    part = 0
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        chunk = s.read(s.in_waiting or 1)
        if not chunk:
            continue
        for byte in chunk:
            b = bytes([byte])
            if b == b"\x04":
                part += 1
                if part == 2:
                    return out_err[0], out_err[1]
                continue
            out_err[part] += b
            if part == 0:
                sys.stdout.write(b.decode("utf-8", "replace"))
                sys.stdout.flush()
    raise TimeoutError("El script no terminó a tiempo (¿bucle infinito?). Usa Ctrl-C en el REPL.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script")
    ap.add_argument("--port", default="COM6")
    ap.add_argument("--timeout", type=float, default=60)
    args = ap.parse_args()

    with open(args.script, "rb") as f:
        code = f.read()

    s = open_port(args.port)
    try:
        enter_raw_repl(s)
        _, err = run(s, code, args.timeout)
    finally:
        s.write(b"\x02")  # Ctrl-B: volver al REPL normal
        s.close()

    if err.strip():
        sys.stderr.write("\n--- Error en la placa ---\n" + err.decode("utf-8", "replace") + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
