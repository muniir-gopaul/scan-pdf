# -*- coding: utf-8 -*-

import re
import json
import sys
import time
from pathlib import Path
from datetime import datetime
import pdfplumber
import traceback
import os


# ------------------------------------------------------
# SAFE STDERR LOGGING (never pollute stdout)
# ------------------------------------------------------
def log_err(msg):
    sys.stderr.write(str(msg) + "\n")
    sys.stderr.flush()


# ------------------------------------------------------
# 1. HEADER EXTRACTION (PO Number + Order Date)
# ------------------------------------------------------
def extract_header(pdf_path):
    header = {}

    with pdfplumber.open(pdf_path) as pdf:
        texts = []
        for page in pdf.pages:
            try:
                texts.append(page.extract_text() or "")
            except Exception:
                continue

        full_text = "\n".join(texts)

    # -------------------------------
    # PO NUMBER
    # -------------------------------
    po_match = re.search(
        r"PURCHASE\s+ORDER\s*[:\-]?\s*([0-9A-Za-z]+)",
        full_text,
        re.I
    )
    if po_match:
        header["PONumber"] = po_match.group(1).strip()

    # -------------------------------
    # ORDER DATE
    # -------------------------------
    date_match = re.search(
        r"(ORDER\s+DATE|DATE)\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})",
        full_text,
        re.I
    )

    if date_match:
        raw_date = date_match.group(2).strip()

        for fmt in (
            "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
            "%d/%m/%y", "%d-%m-%y", "%d.%m.%y"
        ):
            try:
                parsed = datetime.strptime(raw_date, fmt)
                header["OrderDate"] = parsed.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    return header


# ------------------------------------------------------
# 2. ROW EXTRACTION (RIGHT-ANCHORED, STABLE)
# ------------------------------------------------------
def extract_rows(pdf_path):
    rows = []
    row_id = 1

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                continue

            lines = [l.strip() for l in text.split("\n") if l.strip()]

            for line in lines:
                # Must start with barcode
                m = re.match(r"^(\d{7,14})\s+(.*)$", line)
                if not m:
                    continue

                barcode = m.group(1)
                rest = m.group(2)

                nums = re.findall(r"[0-9]+(?:[.,][0-9]+)?", rest)
                if len(nums) < 3:
                    continue

                # RIGHT-ANCHORED
                total = nums[-1]
                pu = nums[-2]
                qty = nums[-3]

                # Handle split totals (e.g. "7182 00")
                if len(total) <= 2 and len(nums) >= 4:
                    total = f"{nums[-2]}.{nums[-1]}"
                    pu = nums[-3]
                    qty = nums[-4]

                qty = qty.replace(",", "")
                pu = pu.replace(",", "")
                total = total.replace(",", "")

                desc = rest
                for n in (qty, pu, total.split(".")[0]):
                    if n in desc:
                        desc = desc.rsplit(n, 1)[0]

                rows.append({
                    "_id": row_id,
                    "Barcode": barcode,
                    "Description": desc.strip(),
                    "Qty": qty,
                    "PU_HT": pu,
                    "Total_HT": total,
                })

                row_id += 1

    return rows


# ------------------------------------------------------
# 3. MAIN ENTRY (NODE SAFE)
# ------------------------------------------------------
def run(pdf_path, out_dir=None):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    header = extract_header(pdf_path)
    rows = extract_rows(pdf_path)

    payload = {
        "success": True,
        "header": header,
        "rows": rows,
        "columns": [
            {"name": "Barcode", "label": "Barcode", "field": "Barcode", "align": "left"},
            {"name": "Description", "label": "Description", "field": "Description", "align": "left"},
            {"name": "Qty", "label": "Qty", "field": "Qty", "align": "right"},
            {"name": "PU_HT", "label": "PU (HT)", "field": "PU_HT", "align": "right"},
            {"name": "Total_HT", "label": "Total (HT)", "field": "Total_HT", "align": "right"},
        ],
    }

    if out_dir:
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = int(time.time() * 1000)
        json_path = out_dir / f"dreamprice_{ts}.json"
        json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # 🔐 JSON ONLY on stdout (Node depends on this)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()
    return payload


# ------------------------------------------------------
# 4. CLI ENTRYPOINT (HARD SAFE)
# ------------------------------------------------------
if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing PDF path")

        pdf = sys.argv[1]
        out = sys.argv[2] if len(sys.argv) > 2 else None

        run(pdf, out)

    except Exception as e:
        log_err("❌ PYTHON EXTRACT ERROR")
        log_err(str(e))
        log_err(traceback.format_exc())

        error_payload = {
            "success": False,
            "error": str(e)
        }

        sys.stdout.write(json.dumps(error_payload))
        sys.stdout.flush()
        sys.exit(1)
