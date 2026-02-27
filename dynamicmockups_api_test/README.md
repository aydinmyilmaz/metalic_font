# Dynamic Mockups API Test

Bu klasor, ana uygulamadan bagimsiz PSD upload + render test scriptini icerir.

## Hizli Calistir

```bash
cd dynamicmockups_api_test
uv run --python 3.11 --with requests run_psd_upload_test.py --api-key "<YOUR_API_KEY>"
```

## Parametreler

- `--api-key`: Dynamic Mockups API key (zorunlu).
- `--psd-url`: Public PSD URL.
- `--design-url`: Smart object icine basilacak gorsel URL.
- `--skip-render`: Sadece upload test et.
- `--skip-mockup-list`: Mockup liste adimini atla.
- `--output-json`: Sonuc JSON dosyasi (default: `last_run.json`).

## Not

- Script default olarak smart object iceren public bir PSD URL kullanir.
- Ilk smart object (`--smart-object-index 0`) ile render alir.
