"""Muestra lo que imprime el ESP32 por el puerto serie durante N segundos.

Uso:  python tools/monitor.py [--port COM6] [--seconds 60]
"""
import argparse
import sys
import time

import serial


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="COM6")
    ap.add_argument("--seconds", type=float, default=60)
    args = ap.parse_args()

    s = serial.Serial()
    s.port, s.baudrate, s.timeout = args.port, 115200, 0.2
    s.dtr = False
    s.rts = False
    s.open()
    end = time.monotonic() + args.seconds
    try:
        while time.monotonic() < end:
            data = s.read(s.in_waiting or 1)
            if data:
                sys.stdout.write(data.decode("utf-8", "replace"))
                sys.stdout.flush()
    finally:
        s.close()


if __name__ == "__main__":
    main()
