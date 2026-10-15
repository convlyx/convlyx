"""Gera os PDFs comerciais a partir dos HTML desta pasta.

Uso:  python docs/sales/_src/build.py [nome ...]
      (sem argumentos gera todos)

Requisitos: Python 3, `pip install qrcode pillow`, e Microsoft Edge ou Google Chrome.
Os contactos e o destino do QR vêm de config.json.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import qrcode

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
CONFIG = json.loads((SRC / "config.json").read_text(encoding="utf-8"))

DOCS = {
    "folheto": "03-folheto-escolas-fundadoras.pdf",
    "precos": "04-precos-2026.pdf",
    "ficha": "05-ficha-de-adesao.pdf",
    "plano": "01-plano-comercial.pdf",
}

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
]


def browser() -> str:
    for b in BROWSERS:
        if Path(b).exists() or shutil.which(b):
            return b
    sys.exit("Não encontrei Edge/Chrome para gerar os PDFs.")


def contact_block() -> str:
    people = []
    for c in CONFIG["contacts"]:
        line = f"<b>{c['name']}</b>"
        if c.get("phone"):
            line += f" &nbsp;·&nbsp; {c['phone']}"
        people.append(line)
    return " &nbsp;&nbsp;|&nbsp;&nbsp; ".join(people + [CONFIG["email"]])


def make_qr() -> str:
    path = SRC / "assets" / "qr.png"
    path.parent.mkdir(exist_ok=True)
    img = qrcode.make(CONFIG["qr_url"], border=1, box_size=12)
    img.save(path)
    return "assets/qr.png"


def render(name: str, chrome: str, qr: str) -> None:
    html = (SRC / f"{name}.html").read_text(encoding="utf-8")
    html = (
        html.replace("{{CONTACT_BLOCK}}", contact_block())
        .replace("{{CONTACT_EMAIL}}", CONFIG["email"])
        .replace("{{QR_SRC}}", qr)
        .replace("{{QR_LABEL}}", CONFIG["qr_label"])
    )
    tmp = SRC / f".render-{name}.html"
    tmp.write_text(html, encoding="utf-8")
    out = OUT / DOCS[name]
    try:
        subprocess.run(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--no-pdf-header-footer",
                "--allow-file-access-from-files",
                "--virtual-time-budget=15000",
                f"--print-to-pdf={out}",
                tmp.as_uri(),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        tmp.unlink(missing_ok=True)
    print(f"ok  {out.relative_to(OUT.parent.parent)}")


def main() -> None:
    names = sys.argv[1:] or list(DOCS)
    chrome = browser()
    qr = make_qr()
    for n in names:
        render(n, chrome, qr)


if __name__ == "__main__":
    main()
