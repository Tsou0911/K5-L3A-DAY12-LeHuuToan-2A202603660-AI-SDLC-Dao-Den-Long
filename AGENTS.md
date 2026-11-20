# Đảo Đèn Lồng

- Dùng Node.js 22.12+; cài bằng `npm install`, build bằng `npm run build`, test bằng `npm test`.
- Headless sau build: `node dist/headless.js --seed 42 --night 1 --ticks 120 --out run.jsonl`.
- Mọi luật chơi nằm trong `src/core`. Renderer chỉ chuyển input và đọc snapshot. Core độc lập với Three.js, DOM, hệ thống file và đồng hồ máy.
- Mỗi bước đúng 1/60 giây. Lấy ngẫu nhiên từ PRNG theo seed. Máy khách dùng bộ tích lũy thời gian.
- Không tắt test hoặc sửa output bằng tay. Ghi TODO cho việc chưa kiểm chứng.
- Không commit API key, .env hoặc secret.
