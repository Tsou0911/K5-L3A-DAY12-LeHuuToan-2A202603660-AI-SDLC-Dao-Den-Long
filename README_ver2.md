# Đảo Đèn Lồng

Game 3D trên trình duyệt. Trong đêm đầu tiên, Mây có ba ngọn lửa và năm phút để thắp năm đèn trên đảo. Mỗi đèn cần ba đom đóm. Đi vào vùng sáng để tránh sát thương của Bóng Mực.

## Cài và chơi

Dùng Node.js 22.12+ với npm trên Windows, macOS hoặc Linux. Chạy tại thư mục chứa `package.json`, rồi mở địa chỉ Vite in trong terminal.

```sh
npm install
npm run build
npm run dev
```

Dùng **WASD** để đi, **J** để nhảy, **E** để nạp đèn, **F** hoặc **Space** để phát xung. Đom đóm được nhặt tự động. Sau khi kết thúc, chọn **Chơi lại**.

## Điểm và kiểm thử

Mỗi đom đóm nhặt được cộng 10 điểm, mỗi đèn vừa thắp cộng 500 điểm và mỗi Bóng Mực mới bị choáng cộng 50 điểm. Khi thắng, mỗi giây tròn còn lại cộng 2 điểm và mỗi lửa còn lại cộng 100 điểm.

Chạy `npm test` để kiểm tra engine và CLI. Sau khi build, lệnh dưới đây dựng bốn đèn đã sáng, nạp ba mote cho đèn cuối ở tick đầu và ghi replay thắng vào `win.jsonl`.

```sh
node dist/headless.js --seed 42 --night 1 --ticks 60 --scenario scenarios/win-one-lantern.json --inputs scenarios/interact.inputs.json --snapshot-every 1 --out win.jsonl
```

Bản web sau build ở `dist/client/`. CLI ở `dist/headless.js`. [Lệnh kiểm thử và headless](AGENTS.md) · [Quy ước dữ liệu và cách tính điểm](docs/notes/phase-1.md) · [Bằng chứng Phase 1](docs/proof/phase-1/README.md).
