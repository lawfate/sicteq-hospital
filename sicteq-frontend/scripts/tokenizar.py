# Pasa los colores sueltos de Tailwind de una pantalla a los tokens del tema
# oscuro (src/index.css). Se usó una vez por pantalla al rediseñar; queda para
# las pantallas que se agreguen. Uso: python scripts/tokenizar.py src/components/X.jsx ...
import re
import sys

REEMPLAZOS = [
    # superficies
    (r'bg-white rounded-xl border border-slate-200 shadow-sm', 'rounded-lg border border-border bg-card'),
    (r'bg-white rounded-xl shadow-sm border border-slate-200', 'rounded-lg border border-border bg-card'),
    (r'\brounded-xl\b', 'rounded-lg'),
    (r'\s*\bshadow-(sm|md|lg|xl|2xl)\b', ''),
    (r'\bbg-white\b', 'bg-card'),
    (r'\bbg-slate-50\b', 'bg-muted/40'),
    (r'\bbg-slate-100\b', 'bg-muted'),
    (r'\bbg-slate-(800|900)\b', 'bg-foreground'),
    (r'\bhover:bg-slate-(50|100)\b', 'hover:bg-muted'),
    (r'\bhover:bg-slate-(800|900)\b', 'hover:bg-foreground/90'),
    # texto
    (r'\btext-slate-(700|800|900)\b', 'text-foreground'),
    (r'\btext-slate-(300|400|500|600)\b', 'text-muted-foreground'),
    (r'\btext-white\b', 'text-primary-foreground'),
    # bordes
    (r'\bborder-slate-(100|200|300)\b', 'border-border'),
    (r'\bdivide-slate-(100|200)\b', 'divide-border'),
    # acción
    (r'\bbg-sky-(500|600)\b', 'bg-primary'),
    (r'\bhover:bg-sky-(600|700)\b', 'hover:bg-primary/90'),
    (r'\bbg-sky-700\b', 'bg-primary/80'),
    (r'\bdisabled:bg-sky-400\b', 'disabled:opacity-50'),
    (r'\btext-sky-(500|600|700|800)\b', 'text-primary'),
    (r'\bbg-sky-(50|100)\b', 'bg-primary/10'),
    (r'\bborder-sky-(200|300)\b', 'border-primary/40'),
    (r'\bfocus:ring-sky-500\b', 'focus:ring-primary'),
    # estados
    (r'\bbg-(emerald|green)-(50|100)\b', 'bg-ok/15'),
    (r'\btext-(emerald|green)-(600|700|800)\b', 'text-ok'),
    (r'\bborder-(emerald|green)-(100|200)\b', 'border-ok/40'),
    (r'\bbg-(emerald|green)-600\b', 'bg-ok'),
    (r'\bhover:bg-(emerald|green)-700\b', 'hover:bg-ok/90'),
    (r'\bbg-(amber|yellow)-(50|100)\b', 'bg-warn/15'),
    (r'\btext-(amber|yellow)-(600|700|800)\b', 'text-warn'),
    (r'\bborder-(amber|yellow)-(100|200|300)\b', 'border-warn/40'),
    (r'\bbg-(red|rose)-(50|100)\b', 'bg-danger/15'),
    (r'\btext-(red|rose)-(500|600|700)\b', 'text-danger'),
    (r'\bborder-(red|rose)-(100|200|300)\b', 'border-danger/40'),
    (r'\bbg-(red|rose)-600\b', 'bg-danger'),
    (r'\bhover:bg-(red|rose)-(50|100)\b', 'hover:bg-danger/10'),
    (r'\bhover:bg-(red|rose)-700\b', 'hover:bg-danger/90'),
    (r'\bbg-(blue|indigo|purple)-(50|100)\b', 'bg-primary/15'),
    (r'\btext-(blue|indigo|purple)-(600|700)\b', 'text-primary'),
]

for ruta in sys.argv[1:]:
    s = open(ruta, encoding='utf-8').read()
    total = 0
    for patron, nuevo in REEMPLAZOS:
        s, n = re.subn(patron, nuevo, s)
        total += n
    open(ruta, 'w', encoding='utf-8').write(s)
    quedan = sorted(set(re.findall(r'\b(?:bg|text|border|divide)-(?:slate|sky|emerald|amber|red|rose|blue|indigo|purple|gray)-\d+\b', s)))
    print(f'{ruta}: {total} reemplazos; quedan: {quedan or "ninguno"}')
