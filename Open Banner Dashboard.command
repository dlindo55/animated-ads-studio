#!/bin/zsh
cd -- "${0:A:h}" || exit
exec python3 source/server.py --open
