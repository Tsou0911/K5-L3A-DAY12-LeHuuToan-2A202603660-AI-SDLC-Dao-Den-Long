# Phase 1 · Quy ước triển khai

Bản mô tả của người dùng là nguồn cho contract v1.0. Vị trí dùng mét và bộ ba [x,y,z], với y hướng lên. Input move là [phải, lùi], yaw tính theo độ, yaw 0 nhìn về −Z. Nhảy bằng J. Trường dash dành cho phase sau.

Mỗi tick kéo dài 1/60 giây. Snapshot 0 chứa dữ liệu scenario trước mọi hành động. Frame input k tác động lên snapshot k+1. File input là mảng frame hoặc đối tượng có trường frames. Các trường giữ giá trị cũ. Jump, interact, pulse và dash chỉ kích hoạt ở cạnh lên. CLI ghi snapshot mỗi 10 tick theo mặc định, event trước snapshot cùng tick, và end kể cả khi chạy 0 tick.

Mặc định seed tạo 30 mote và 2 shade. random_motes/random_shades nhận số lượng nguyên hoặc boolean (true dùng mặc định, false dùng 0). Danh sách tường minh thay toàn bộ thực thể tương ứng. Có quân tăng viện mỗi 30 giây khi bật shade ngẫu nhiên. Lantern được vá theo id. Đèn đánh dấu lit được nạp đủ ngay ở tick 0. Scenario không tạo event và có điểm ban đầu bằng 0.

Trong mỗi bước, engine di chuyển, nhặt, nạp cho đèn chưa sáng gần nhất, xử lý xung, di chuyển shade, xử lý va chạm rồi xét kết thúc. Đứng trong bán kính 5 m quanh đèn sáng được bảo vệ. Trúng đòn mất một lửa và mất floor(carried × 0.5) đom đóm. Mọi bán kính dùng khoảng cách trên mặt phẳng XZ. Khi vượt mép đảo bán kính 16 m, người chơi quay về tâm đảo. Giả định Phase 1 dùng chung quy tắc sát thương và miễn nhiễm cho va chạm và rơi. Nếu chịu sát thương khi rơi, event player_hit ghi by=fall, số lửa còn lại và số mote mất. Khi trùng tick, hết lửa được ưu tiên, sau đó thắp đủ đèn, sau cùng hết giờ.

| Nguồn điểm | Cách cộng |
|---|---|
| Nhặt một mote | +10 |
| Thắp một đèn | +500 |
| Một shade bắt đầu bị choáng | +50 |
| Thắng | +2 × số giây còn lại làm tròn xuống, +100 × số lửa còn lại |

### Quy ước JSONL

Trong Phase 1, sim_tick bằng tick. Motes_active (khóa JSON `motes_active`) là số mote còn trên đảo. Tọa độ JSON dùng số làm tròn đến 0,001 m. Engine giữ tọa độ đầy đủ giữa các bước. Shade đang đuổi có state là `chasing`, shade đang choáng là `stunned`. ID tự sinh dùng tiền tố M hoặc S và số nguyên dương tăng dần, bỏ qua ID tường minh đã được giữ chỗ trong danh sách.

### Ghi nhận Checkpoint 1

Bản đầu đạt unit test nhưng xuất snapshot nội bộ, sai vỏ event và đo bán kính trong không gian 3D. Bộ test hiện chạy CLI thật trên dữ liệu có chênh cao, kiểm tra các trường JSON, lỗi stderr, mã thoát và so byte. Ba lệnh replay trong bảng bằng chứng tái tạo kết quả độc lập với test. TODO bổ sung số liệu token/chi phí khi có thống kê phiên.

Thông số được đọc từ game.contract.json. Ví dụ thắng mẫu còn 3 lửa và 299 giây tròn, được 500 + 598 + 300 = 1398 điểm.
