# Đảo Đèn Lồng — Hướng dẫn Phase 2

Game 3D trên trình duyệt. Mây đi qua ba đêm và ba hòn đảo, thu thập đom đóm, thắp Đèn Lồng Lớn, tránh Bóng Mực và đối phó với Gió Lạc.

## Cài đặt, build và chạy

Cần Node.js 22.12 trở lên. Từ thư mục dự án:

```sh
npm install
npm run build
npm run dev
```

Mở địa chỉ local mà Vite in trong terminal. Nếu PowerShell chặn `npm.ps1`, thay `npm` bằng `npm.cmd`. Bản web build nằm ở `dist/client/`; CLI headless nằm ở `dist/headless.js`.

## Điều khiển

- **W / A / S / D** hoặc **phím mũi tên**: di chuyển.
- **J**: nhảy; **Shift**: lướt.
- **E**: nạp đom đóm vào đèn gần nhất.
- **F** hoặc **Space**: Tỏa Sáng.
- **V**: chuyển giữa camera thứ ba và camera nhìn từ trên xuống.
- **Kéo chuột trái**: xoay camera; độ nhạy có thể chỉnh trong Cài đặt.
- **P / Esc**: tạm dừng.

Đom đóm được nhặt tự động khi tới gần. Đèn đã sáng tạo vùng an toàn khỏi Bóng Mực. Gió Lạc có thể cướp đom đóm; dùng Tỏa Sáng đúng lúc để xua chúng hoặc lấy lại số đom đóm đã cướp. Bùa Gió tăng tốc chạy và bỏ hồi chiêu lướt trong thời gian hiệu lực.

## Ba đêm

| Đêm | Đảo | Đèn | Thời gian | Đặc điểm |
|---|---|---:|---:|---|
| 1 | Đảo Bến | 5 | 5:00 | Đảo tròn và các điểm sương quanh mép |
| 2 | Đảo Cau | 6 | 5:30 | Hai đảo nối bằng cầu tre và hai bục nhảy |
| 3 | Đảo Chuông | 7 | 6:00 | Ba tầng, dốc, tháp chuông và gió mạnh |

Mỗi đêm bắt đầu với ba Ngọn Lửa. Thắp hết đèn để thắng đêm; hết giờ hoặc hết lửa thì thua. Sau khi thua, có thể chơi lại đêm đó. Thắng cả ba đêm sẽ hiện Bình Minh và tổng điểm chiến dịch.

## Tính điểm

- Nạp mỗi đom đóm: **10 điểm**.
- Thắp mỗi đèn: **100 điểm**.
- Mỗi Bóng Mực trúng Tỏa Sáng: **5 điểm**.
- Khi thắng một đêm: `floor(giây còn lại) × 2 + 50 × số Ngọn Lửa còn`.
- Điểm chiến dịch cộng các đêm đã thắng.

Số liệu chuẩn và Test Contract v1.1 được khai báo trong [`game.contract.json`](game.contract.json); giả định và tiêu chí nghiệm thu ở [`docs/notes/phase-2.md`](docs/notes/phase-2.md).

## Test và headless

```sh
npm test
```

Ví dụ chạy Night 3 đến hết 21.600 tick:

```sh
node dist/headless.js --seed 42 --night 3 --ticks 21600 --scenario scenarios/phase-2/full-night.json --inputs scenarios/phase-2/full-night.inputs.json --snapshot-every 60 --out night-3.jsonl
```

`npm run build` tạo CLI trước khi chạy. Snapshot/event được ghi JSONL; dòng cuối là `end`. Scenario, replay, FPS, ảnh và hướng dẫn kiểm chứng nằm trong [`docs/proof/phase-2/README.md`](docs/proof/phase-2/README.md).
