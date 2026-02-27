#!/usr/bin/env python3
"""
Dynamic Mockups PSD upload + render smoke test.

Usage (uv + Python 3.11):
  uv run --python 3.11 --with requests run_psd_upload_test.py --api-key "<KEY>"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any

import requests

BASE_URL = "https://app.dynamicmockups.com/api/v1"
DEFAULT_PSD_URL = (
    "https://raw.githubusercontent.com/joonaspaakko/"
    "Batch-Mockup-Smart-Object-Replacement-photoshop-script/master/"
    "Examples/example-1/assets/Mug%20PSD%20MockUp%202/Mug%20PSD%20MockUp%202.psd"
)
DEFAULT_DESIGN_URL = "https://picsum.photos/1200/1200.jpg"


def mask_key(key: str) -> str:
    if len(key) <= 12:
        return "*" * len(key)
    return f"{key[:8]}...{key[-6:]}"


def api_request(
    method: str,
    path: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    url = f"{BASE_URL}{path}"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-api-key": api_key,
    }
    response = requests.request(method, url, headers=headers, json=payload, timeout=timeout)
    try:
        data = response.json()
    except Exception:
        data = {"success": False, "message": f"Non-JSON response: {response.text[:500]}"}

    if response.status_code >= 400:
        raise RuntimeError(
            f"{method} {path} failed ({response.status_code}): "
            f"{data.get('message') or data}"
        )
    return data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dynamic Mockups API PSD upload/render test")
    parser.add_argument("--api-key", default=os.getenv("DYNAMICMOCKUPS_API_KEY", "").strip())
    parser.add_argument("--psd-url", default=DEFAULT_PSD_URL)
    parser.add_argument("--psd-name", default="")
    parser.add_argument("--psd-category-id", type=int, default=6)
    parser.add_argument("--design-url", default=DEFAULT_DESIGN_URL)
    parser.add_argument("--fit", default="contain", choices=["contain", "cover", "stretch"])
    parser.add_argument("--image-format", default="png", choices=["png", "jpg", "webp"])
    parser.add_argument("--image-size", type=int, default=1500)
    parser.add_argument("--mode", default="view", choices=["view", "print"])
    parser.add_argument("--smart-object-index", type=int, default=0)
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--skip-mockup-list", action="store_true")
    parser.add_argument("--output-json", default="last_run.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.api_key:
        print("ERROR: --api-key verilmedi ve DYNAMICMOCKUPS_API_KEY env bos.", file=sys.stderr)
        return 2

    psd_name = args.psd_name or f"api_test_{int(time.time())}"
    print(f"Using API key: {mask_key(args.api_key)}")
    print(f"Uploading PSD: {args.psd_url}")

    upload_payload = {
        "psd_file_url": args.psd_url,
        "psd_name": psd_name,
        "psd_category_id": args.psd_category_id,
        "mockup_template": {
            "create_after_upload": True,
            "collections": [],
        },
    }
    upload_result = api_request("POST", "/psd/upload", args.api_key, upload_payload)
    if not upload_result.get("success"):
        print("PSD upload failed:", upload_result.get("message") or upload_result)
        return 1

    data = upload_result.get("data", {})
    mockup_uuid = data.get("uuid")
    smart_objects = data.get("smart_objects", []) or []
    psd_uuid = (data.get("psd") or {}).get("uuid")
    print(f"Upload success. mockup_uuid={mockup_uuid} smart_objects={len(smart_objects)} psd_uuid={psd_uuid}")

    result_bundle: dict[str, Any] = {
        "upload": upload_result,
    }

    if not args.skip_render:
        if not smart_objects:
            print("Render skipped: mockup smart object yok.")
        elif args.smart_object_index < 0 or args.smart_object_index >= len(smart_objects):
            print(
                f"Render skipped: smart-object-index {args.smart_object_index} gecersiz "
                f"(0..{len(smart_objects)-1})."
            )
        else:
            chosen = smart_objects[args.smart_object_index]
            render_payload = {
                "mockup_uuid": mockup_uuid,
                "export_label": f"{psd_name}_render",
                "export_options": {
                    "image_format": args.image_format,
                    "image_size": args.image_size,
                    "mode": args.mode,
                },
                "smart_objects": [
                    {
                        "uuid": chosen["uuid"],
                        "asset": {
                            "url": args.design_url,
                            "fit": args.fit,
                        },
                    }
                ],
            }
            print(f"Rendering smart object: {chosen.get('name')} ({chosen.get('uuid')})")
            render_result = api_request("POST", "/renders", args.api_key, render_payload)
            result_bundle["render"] = render_result
            if render_result.get("success"):
                export_path = (render_result.get("data") or {}).get("export_path")
                print(f"Render success: {export_path}")
            else:
                print("Render failed:", render_result.get("message") or render_result)

    if not args.skip_mockup_list:
        list_result = api_request("GET", "/mockups?limit=5", args.api_key, None)
        result_bundle["mockups"] = list_result
        count = len(list_result.get("data", []) or [])
        print(f"Mockup list success: {count} item")

    output_path = args.output_json
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result_bundle, f, ensure_ascii=False, indent=2)
    print(f"Saved run output: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
