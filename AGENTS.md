# Đảo Đèn Lồng

- Dùng Node.js 22.12+; cài bằng `npm install`, build bằng `npm run build`, test bằng `npm test`.
- Headless sau build: `node dist/headless.js --seed 42 --night 1 --ticks 120 --out run.jsonl`.
- Mọi luật chơi nằm trong `src/core`. Renderer chỉ chuyển input và đọc snapshot. Core độc lập với Three.js, DOM, hệ thống file và đồng hồ máy.
- Mỗi bước đúng 1/60 giây. Lấy ngẫu nhiên từ PRNG theo seed. Máy khách dùng bộ tích lũy thời gian.
- Không tắt test hoặc sửa output bằng tay. Ghi TODO cho việc chưa kiểm chứng.
- Không commit API key, .env hoặc secret.

## Ticket-03

- Contract 1.2 là luật hiện hành. Giữ `docs/notes/phase-2.md` và `docs/proof/phase-2` làm lịch sử.
- Fuel dùng integer 1/60 nội bộ. Trong `GameEngine.step`, xử lý hao/hút dầu và tắt đèn trước di chuyển; thắng/thua sau mọi cập nhật, hết lửa ưu tiên ở tick cuối.
- Shade `drain` phải có mục tiêu đèn hợp lệ; sự kiện drain mỗi 60 `sim_tick`. Không để pause làm giảm fuel hoặc TTL.
- Chạy `npm.cmd test`, `npm.cmd run build`, rồi `node scripts/verify-replays.mjs`. Bằng chứng hiện hành ở `docs/proof/phase-3`.
- Thử luồng chiến dịch bằng `scripts/check-client.mjs`; đo bản production bằng `scripts/measure-fps.mjs`. Chỉ ghi nhận kết quả thật và nêu rõ phần UI chưa xác minh thủ công.
- Test cũ bị luật mới thay thế phải được cập nhật hoặc giải thích; không skip âm thầm.
