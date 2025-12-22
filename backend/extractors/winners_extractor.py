import sys
import json
import re
import traceback
from datetime import datetime
import pdfplumber


# ------------------------------------------------------
# HEADER EXTRACTION
# ------------------------------------------------------
def extract_header(pdf_path):
    header = {}

    with pdfplumber.open(pdf_path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    # 🔥 REMOVE HEADER NOISE COMPLETELY
    text = re.sub(r"\ben\s*MUR\b", "", text, flags=re.I)
    text = re.sub(r"\bMUR\b", "", text, flags=re.I)

    # PO NUMBER
    m = re.search(r"N[°º]?\s*commande\s*([0-9]+)", text, re.I)
    if m:
        header["PONumber"] = m.group(1)

    # ORDER DATE
    m = re.search(
        r"Date\s+de\s+commande\s*([0-9]{2}/[0-9]{2}/[0-9]{4})",
        text,
        re.I
    )
    if m:
        header["OrderDate"] = datetime.strptime(
            m.group(1), "%d/%m/%Y"
        ).strftime("%Y-%m-%d")

    return header


# ------------------------------------------------------
# ROW EXTRACTION (EAN + Ar ANCHORED)
# ------------------------------------------------------
def extract_rows(pdf_path):
    rows = []
    table_started = False
    buffer_desc = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.splitlines() if l.strip()]

            for line in lines:

                # Detect table header
                if re.search(r"N°\s*article.*EAN.*Libellé", line, re.I):
                    table_started = True
                    buffer_desc = []
                    continue

                if not table_started:
                    continue

                # Stop at footer
                if re.search(r"^Nb\s+de\s+lignes", line, re.I):
                    return rows

                # Article + EAN anchor
                m = re.search(r"(\d{5,7})?\s*(\d{8,14})\s+(.*)", line)
                if not m:
                    buffer_desc.append(line)
                    continue

                article = m.group(1) or ""
                barcode = m.group(2)
                tail = m.group(3)

                # Normalize "6Ar" → "6 Ar"
                tail = re.sub(r"(\d)(Ar)\b", r"\1 Ar", tail)

                # -----------------------------------
                # QTY + PRICE EXTRACTION (SAFE)
                # -----------------------------------
                qty_match = re.search(r"(\d+)\s*Ar", tail)
                if not qty_match:
                    buffer_desc.append(line)
                    continue

                qty = int(qty_match.group(1))

                after_ar = tail.split("Ar", 1)[1]

                price_match = re.search(r"(\d+\.\d{2,4})", after_ar)
                if not price_match:
                    buffer_desc.append(line)
                    continue

                unit_price = float(price_match.group(1))
                total_ht = round(qty * unit_price, 4)

                # -----------------------------------
                # DESCRIPTION CLEANUP
                # -----------------------------------
                desc_part = tail.split(str(qty) + " Ar", 1)[0]

                description = " ".join(buffer_desc + [desc_part]).strip()
                description = re.sub(r"\ben\s*MUR\b", "", description, flags=re.I)
                description = re.sub(r"\bMUR\b", "", description, flags=re.I)
                description = re.sub(r"\s{2,}", " ", description).strip()

                buffer_desc = []

                rows.append({
                    "Article": article,
                    "Barcode": barcode,
                    "Description": description,
                    "Qty": str(qty),
                    "PU_HT": f"{unit_price:.2f}",
                    "TOTAL_HT": f"{total_ht:.2f}",
                    "page": page_idx
                })


    return rows


# ------------------------------------------------------
# MAIN (NODE SAFE ENTRYPOINT)
# ------------------------------------------------------
def main():
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing PDF path")

        pdf_path = sys.argv[1]

        payload = {
            "supplier": "winners",
            "header": extract_header(pdf_path) or {},
            "rows": extract_rows(pdf_path) or [],
            "columns": [
                { "name": "Barcode", "label": "EAN", "field": "Barcode", "align": "left" },
                { "name": "Description", "label": "Description", "field": "Description", "align": "left" },
                { "name": "Qty", "label": "Qté", "field": "Qty", "align": "right" },
                { "name": "PU_HT", "label": "Prix achat (MUR)", "field": "PU_HT", "align": "right" },
                { "name": "TOTAL_HT", "label": "Total (HT)", "field": "TOTAL_HT", "align": "right" }
            ]
        }

        sys.stdout.write(json.dumps(payload))
        sys.stdout.flush()
        sys.exit(0)

    except Exception as e:
        sys.stdout.write(json.dumps({
            "supplier": "winners",
            "header": {},
            "rows": [],
            "columns": [],
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.stdout.flush()
        sys.exit(0)


if __name__ == "__main__":
    main()
