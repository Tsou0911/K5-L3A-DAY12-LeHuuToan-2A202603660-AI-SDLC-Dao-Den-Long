# Đảo Đèn Lồng

Game 3D trên trình duyệt cho Phase 2 của Day 12 AI SDLC Lab. Mây, người giữ đèn nhỏ tuổi, thu thập đom đóm, thắp đèn qua Đảo Bến, Đảo Cau và Đảo Chuông.

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
- **Shift** lướt, **V** đổi góc nhìn, kéo chuột để xoay camera, **P/Esc** tạm dừng. Cài đặt lưu âm lượng và độ nhạy chuột trên trình duyệt.
- Đom đóm được tự động nhặt khi Mây đến gần.
- Mỗi đèn cần 10 đom đóm. Thắp đủ 5, 6 hoặc 7 đèn trong 300, 330 hoặc 360 giây tương ứng với từng đêm. Mây bắt đầu với ba ngọn lửa; bị Bóng Mực chạm hoặc rơi khỏi đảo có thể khiến Mây mất lửa. Mất hết lửa hoặc hết thời gian thì thua.
- Thắng để mở đêm kế tiếp; thua có thể chơi lại đêm hiện tại. Bình Minh ghi tổng điểm ba đêm thắng.

## Tính điểm

- Nạp mỗi đom đóm: **10 điểm**.
- Thắp mỗi đèn: **100 điểm**.
- Mỗi Bóng Mực trúng xung: **5 điểm**.
- Khi thắng: mỗi giây còn lại (làm tròn xuống) được **2 điểm**, và mỗi ngọn lửa còn lại được **50 điểm**.

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

CLI nhận `--seed`, `--night 1|2|3`, `--ticks`, `--out`, cùng các tùy chọn `--scenario`, `--inputs` và `--snapshot-every`. Mỗi dòng output là một snapshot hoặc event JSON; dòng cuối là `end`. Xem [Test Contract](game.contract.json), [scenario mẫu](scenarios/) và [bằng chứng Phase 1](docs/proof/phase-1/README.md).

[Tiêu chí Phase 2](docs/notes/phase-2.md) · [Bằng chứng và cách chạy lại](docs/proof/phase-2/README.md)

## Tài liệu

- [Hướng dẫn dự án bổ sung](README_ver2.md)
- [Giả định và quy ước Phase 1](docs/notes/phase-1.md)
- [Harness hướng dẫn agent](AGENTS.md)
- [Hướng dẫn lab](GUIDE.md) · [Checkpoints](CHECKPOINTS.md) · [Nộp bài](SUBMISSION.md)
- [Quy định](RULES.md) · [Rubric](RUBRIC.md)
- [Nguồn asset](CREDITS.md) · [License](LICENSE)
