# Đảo Đèn Lồng

Game 3D trên trình duyệt cho Phase 1 của Day 12 AI SDLC Lab. Mây, người giữ đèn nhỏ tuổi, thu thập đom đóm, thắp năm Đèn Lồng Lớn và tránh Bóng Mực trên một hòn đảo giữa biển mây.

## Cài đặt và chạy

Cần Node.js 22.12 trở lên và npm. Tại thư mục dự án, chạy:

```sh
npm install
npm run build
npm run dev
```

Vite sẽ in địa chỉ local trong terminal; mở địa chỉ đó bằng trình duyệt có hỗ trợ WebGL. Trong PowerShell nếu `npm` bị chặn bởi Execution Policy, dùng `npm.cmd` thay cho `npm` trong các lệnh trên. Lệnh chạy game theo contract là `npm run dev`; bản build nằm trong `dist/client/`.

## Cách chơi

- **W / A / S / D** hoặc **phím mũi tên**: di chuyển.
- **J**: nhảy.
- **E**: nạp đom đóm vào Đèn Lồng Lớn gần nhất.
- **F** hoặc **Space**: phát xung sáng để làm Bóng Mực choáng.
- Đom đóm được tự động nhặt khi Mây đến gần.
- Thắp đủ năm đèn để thắng. Mây bắt đầu với ba ngọn lửa; bị Bóng Mực chạm hoặc rơi khỏi đảo có thể khiến Mây mất lửa. Mất hết lửa hoặc hết thời gian thì thua.
- Sau khi thắng hoặc thua, chọn **Chơi lại** để bắt đầu ván mới.

## Tính điểm

- Nhặt mỗi đom đóm: **10 điểm**.
- Thắp mỗi đèn: **500 điểm**.
- Làm một Bóng Mực mới choáng: **50 điểm**.
- Khi thắng: mỗi giây còn lại (làm tròn xuống) được **2 điểm**, và mỗi ngọn lửa còn lại được **100 điểm**.

Các thông số gameplay được khai báo trong [`game.contract.json`](game.contract.json).

## Kiểm thử và chạy headless

Chạy test engine và CLI:

```sh
npm test
```

`npm run build` cũng tạo CLI headless tại `dist/headless.js`. Ví dụ chạy scenario thắp đèn:

```sh
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/win-one-lantern.json --inputs scenarios/interact.inputs.json --snapshot-every 1 --out win.jsonl
```

CLI nhận `--seed`, `--night 1`, `--ticks`, `--out`, cùng các tùy chọn `--scenario`, `--inputs` và `--snapshot-every`. Mỗi dòng output là một snapshot hoặc event JSON; dòng cuối là `end`. Xem [Test Contract](game.contract.json), [scenario mẫu](scenarios/) và [bằng chứng Phase 1](docs/proof/phase-1/README.md).

## Tài liệu

- [Hướng dẫn dự án bổ sung](README_ver2.md)
- [Giả định và quy ước Phase 1](docs/notes/phase-1.md)
- [Harness hướng dẫn agent](AGENTS.md)
- [Hướng dẫn lab](GUIDE.md) · [Checkpoints](CHECKPOINTS.md) · [Nộp bài](SUBMISSION.md)
- [Quy định](RULES.md) · [Rubric](RUBRIC.md)
- [Nguồn asset](CREDITS.md) · [License](LICENSE)
