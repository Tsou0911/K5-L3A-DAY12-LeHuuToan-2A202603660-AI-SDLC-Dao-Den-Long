# Bằng chứng Phase 1

Chạy từ gốc dự án sau khi cài dependency và build. Hai lượt replay dùng cùng seed, scenario, file input và khoảng snapshot. Đổi riêng tên tệp đầu ra.

```sh
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/one-mote.json --out docs/proof/phase-1/one-mote.jsonl
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/win-one-lantern.json --inputs scenarios/interact.inputs.json --snapshot-every 1 --out docs/proof/phase-1/replay-a.jsonl
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/win-one-lantern.json --inputs scenarios/interact.inputs.json --snapshot-every 1 --out docs/proof/phase-1/replay-b.jsonl
```

| Yêu cầu | Cách kiểm chứng | Kết quả cần thấy |
|---|---|---|
| Trạng thái ban đầu, input, gameplay | `npm test` | 18/18 đạt, gồm schema, khoảng cách XZ, ID tự sinh, tick/cạnh lên và cả bảy loại event |
| Nhặt mote | one-mote.jsonl | Snapshot 0, mote_picked ở tick 1, end ở tick 60 với 10 điểm |
| Nạp và thắng | replay-a.jsonl | Deposit, lantern_lit, game_over ở tick 1, end won với 1398 điểm |
| Tất định | So byte replay-a.jsonl với replay-b.jsonl | Hai tệp giống hệt |
| Nhịp snapshot mặc định | Bỏ cờ snapshot-every ở lệnh nhặt mote | Tick 0, 10, 20, 30, 40, 50, 60; event ở tick 1 vẫn được ghi |
| HUD và cảnh 3D | Edge headless trên Windows | [Ảnh client](client.png) từ lần trước khớp cảnh và HUD khi mở lại bản hiện tại ở 1280 × 800 |
| Điều khiển và chơi lại | Chơi trực tiếp sau khi cập nhật xử lý focus và input | Người làm xác nhận đã thử lại và điều khiển hoạt động; chưa lưu clip riêng cho lần kiểm tra này |
| Đa nền tảng | Chạy build và test trên macOS/Linux | TODO kiểm chứng trên hai hệ điều hành |

## Kết quả Windows

Node.js portable 22.15.0, npm 10.9.2. Lệnh `npm run build` tạo cả client và CLI. Lệnh `npm test` dựng lại CLI trước khi chạy test. Node test runner chạy 18 test, đạt 18, bỏ qua 0. Bốn phép thử CLI với JSON hỏng và JSON sai cấu trúc cho cả scenario lẫn inputs đều ghi lỗi ra stderr và trả mã 2.

Trên Windows, chạy `fc.exe /b docs\\proof\\phase-1\\replay-a.jsonl docs\\proof\\phase-1\\replay-b.jsonl` để so từng byte. Trên macOS/Linux, lệnh tương ứng là `cmp docs/proof/phase-1/replay-a.jsonl docs/proof/phase-1/replay-b.jsonl`.

[one-mote.jsonl](one-mote.jsonl) có snapshot tick 0, event nhặt ở tick 1 và end ở tick 60 với 10 điểm. [Replay A](replay-a.jsonl) và [replay B](replay-b.jsonl) giống hệt theo phép so sánh byte. Cả hai kết thúc ở tick 1 với 1398 điểm. SHA-256 của replay là `9aeb8a785667d6437b39585218edd9e897aa251d866e8fc1c44250af36f0220c`.

Đã kiểm tra bản sao nguồn trong thư mục tạm trên Windows, ban đầu không có node_modules hoặc dist. Lệnh npm install --offline dùng cache cục bộ, sau đó build thành công và 18/18 test đạt. TODO kiểm tra clone từ Git sau khi mã nguồn được commit theo quyết định của chủ repo.
