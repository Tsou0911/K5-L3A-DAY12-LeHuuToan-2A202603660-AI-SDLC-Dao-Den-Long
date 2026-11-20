# Đảo Đèn Lồng

- Dùng Node.js 22.12+; cài bằng `npm install`, build bằng `npm run build`, test bằng `npm test`.
- Headless sau build: `node dist/headless.js --seed 42 --night 1 --ticks 120 --out run.jsonl`.
- Mọi luật chơi nằm trong `src/core`. Renderer chỉ chuyển input và đọc snapshot. Core độc lập với Three.js, DOM, hệ thống file và đồng hồ máy.
- Mỗi bước đúng 1/60 giây. Lấy ngẫu nhiên từ PRNG theo seed. Máy khách dùng bộ tích lũy thời gian.
- Không tắt test hoặc sửa output bằng tay. Ghi TODO cho việc chưa kiểm chứng.
- Không commit API key, .env hoặc secret.

## Ticket-02

- Contract 1.1 dùng game.contract.json cho tuning, src/core/islands.ts cho tọa độ và địa hình. Renderer đọc lại dữ liệu này.
- Dùng tick cho input và snapshot; dùng sim_tick cho chuyển động, TTL, hồi chiêu và sinh. Kiểm lại 12 bước trước khi đổi thứ tự trong GameEngine.step.
- Chạy npm test rồi npm run build và node scripts/verify-replays.mjs. Bằng chứng mới nằm ở docs/proof/phase-2.
- Thử luồng chiến dịch bằng scripts/check-client.mjs và đo bản production bằng scripts/measure-fps.mjs theo README bằng chứng.
