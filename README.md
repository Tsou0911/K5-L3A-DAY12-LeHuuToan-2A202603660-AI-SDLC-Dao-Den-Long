# Đảo Đèn Lồng

Game 3D chạy trên trình duyệt, hiện theo **Phase 3 / Test Contract v1.2**. Mây phải giữ đủ đèn sáng và sống sót đến bình minh trên Đảo Bến, Đảo Cau và Đảo Chuông.

## Cài đặt và chạy

Cần Node.js 22.12 trở lên:

```sh
npm install
npm run build
npm run dev
```

Mở địa chỉ Vite in ra bằng trình duyệt hỗ trợ WebGL. Trên PowerShell, dùng `npm.cmd` nếu `npm.ps1` bị chặn. Bản web nằm ở `dist/client/`, CLI headless ở `dist/headless.js`.

## Điều khiển

- **W/A/S/D** hoặc phím mũi tên: di chuyển; **J**: nhảy; **Shift**: lướt.
- Đom đóm tự nhặt; **E**: châm dầu hoặc thắp đèn gần nhất.
- **F / Space**: Tỏa Sáng; **V**: đổi camera; kéo chuột: xoay camera.
- **P / Esc**: tạm dừng.

Mỗi đom đóm nạp vào đèn thêm 10 dầu. Đèn đang sáng hao 1 dầu/giây; đèn yếu dưới 30 dầu mất vùng an toàn và Bóng Mực có thể hút dầu. Đèn từng tắt chỉ cần 5 đom đóm để thắp lại. Sức chứa túi tăng 2 sau mỗi lần thắp thành công, tối đa 20.

## Mục tiêu và điểm

Mây bắt đầu mỗi đêm với ba Ngọn Lửa. Thắng bằng cách sống đến bình minh và giữ sáng ít nhất 60% số đèn: 3/5, 4/6, 5/7. Thời lượng lần lượt là **4:00, 4:30, 5:00**. Hết lửa hoặc không đủ đèn sáng khi hết giờ là thua.

- Nạp mỗi đom đóm: **5 điểm**; thắp lần đầu: **100**; thắp lại: **40**.
- Tỏa Sáng trúng Bóng Mực: **5 điểm**, hoặc **15** nếu Bóng đang hút dầu.
- Thắng bình minh: mỗi đèn đang sáng **50 + floor(dầu)** điểm; mỗi Ngọn Lửa còn lại **50 điểm**.
- Không có thưởng thời gian.

Cài đặt **Bảng màu dễ phân biệt** được lưu trên trình duyệt. Thông số chính thức ở [`game.contract.json`](game.contract.json).

## Test và headless

```sh
npm test
npm run build
```

Ví dụ kiểm chứng một lần thắp đèn tại bình minh:

```sh
node dist/headless.js --seed 42 --night 1 --ticks 1 --scenario scenarios/phase-3/win-at-dawn.json --inputs scenarios/interact.inputs.json --snapshot-every 1 --out dawn.jsonl
```

CLI ghi snapshot/event JSONL; dòng cuối là `end`. Xem [ghi chú Phase 3](docs/notes/phase-3.md), [ADR](docs/adr/0003-lantern-fuel-and-dawn-victory.md), [changelog](CHANGELOG.md) và [bằng chứng Phase 3](docs/proof/phase-3/README.md). Bằng chứng [Phase 1](docs/proof/phase-1/README.md) và [Phase 2](docs/proof/phase-2/README.md) là hồ sơ lịch sử của các phiên bản trước.

## Tài liệu

- [Hướng dẫn bổ sung](README_ver2.md) · [Harness agent](AGENTS.md)
- [Giả định Phase 1](docs/notes/phase-1.md) · [đặc tả lịch sử Phase 2](docs/notes/phase-2.md)
- [Hướng dẫn lab](GUIDE.md) · [Checkpoints](CHECKPOINTS.md) · [Nộp bài](SUBMISSION.md)
- [Quy định](RULES.md) · [Rubric](RUBRIC.md) · [CREDITS](CREDITS.md) · [License](LICENSE)
