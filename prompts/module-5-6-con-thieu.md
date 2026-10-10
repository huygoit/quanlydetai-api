# Module 5–6 — Những phần còn thiếu

Ngày ghi: 09/10/2026.

Cách gọi API cho frontend: `prompts/module-5-6-fe.html`. Bản đọc không cần API: `prompts/module-5-6-tong-quan.html`. Quyết định nghiệp vụ: `prompts/module-5-6.md`, mục 5.

Mỗi mục dưới đây ghi việc đó là gì và vì sao hiện chưa làm được.

## Nhắc hạn

Lệnh:

```
node ace remind:module56
```

Repo không có crontab. Cần đặt lịch máy chủ, một lần mỗi ngày.

Một lần chạy:

- Báo cáo tiến độ khi còn đúng 30, 14, 7 hoặc 3 ngày. Nhiệm vụ phải đang thực hiện, báo cáo chưa xong, gửi cho chủ nhiệm.
- Giải trình vào ngày thứ 10 và ngày thứ 13 của hạn 14 ngày, khi đang chờ chỉnh sửa và chưa xong.

Thông báo trong app và email. Cờ đã nhắc giữ không gửi trùng. Lệch khỏi đúng ngày đó thì không bù.

Process web cũng gọi cùng logic: 15 giây sau khi khởi động, rồi mỗi 6 giờ. Tắt process thì lịch này không chạy. Không thay cron.

Chưa nhắc tự động hạn nộp phiếu phản biện. Phòng KH nhắc từng người trên API. Không nhắc sau ngày hạn báo cáo. Không nhắc hạn xử lý nội bộ của các phòng.

## Mở lại biên bản hội đồng đã khóa

Việc này là cho quản trị mở lại BM.12b sau khi đã lưu, sửa rồi lưu lại. Quy tắc đã chốt: lưu xong thì khóa, chỉ ADMIN mở lại và phải có audit.

Hiện không làm được. Lúc lưu, hệ thống không chỉ bật khóa. Nó còn chuyển trạng thái nhiệm vụ: đạt thì sang quyết toán và tạo phiếu quyết toán nháp, cần bổ sung thì sang chỉnh sửa và bắt đầu hạn 14 ngày, không đạt thì chờ phòng KH chọn làm lại hoặc đình chỉ. File Word biên bản cũng đã sinh. Sau đó sửa hội đồng, phiếu nhận xét và biên bản đều bị chặn.

Không có API mở khóa, và không có bước kéo trạng thái, phiếu quyết toán, hạn giải trình cùng file Word về trước lúc lưu. Module 4 có mở lại phiếu chấm. Biên bản cuối kỳ không có đường đó. Tắt khóa mà không hoàn tác thì quyết toán hoặc giải trình bám vào biên bản không còn là bản đã chốt.

## Trang thành tựu nghiên cứu

Việc này là danh sách nhiệm vụ đã hoàn thành, xem theo người, theo năm hoặc theo đơn vị.

Hiện không làm được vì không có bảng thành tựu và không có API danh sách. Khi `HOAN_THANH`, hệ thống chỉ nối thêm một dòng vào `completedResearchTasks` của hồ sơ khoa học: mã, tên, vai trò, năm, xếp loại, kinh phí, thời điểm. Chỉ ghi cho chủ nhiệm và thành viên đã có hồ sơ. Người chưa có hồ sơ khoa học bị bỏ qua. Dữ liệu chỉ đọc được khi mở đúng hồ sơ đó.

## Mẫu in và PDF

Việc này là đổ BM.12b và BM.14 vào mẫu in của nhà trường, rồi xuất PDF.

BM.12b luôn ghi Word theo mục, vì không có file mẫu biên bản. BM.14 đổ mẫu `THANH_LY` nếu quản trị đã tải lên. Chưa có mẫu thì cũng là Word theo mục. Chưa có thư viện PDF.

## Hạn giờ xử lý của từng phòng

Việc này là đếm giờ PKH, KH-TC, CSVC, BGH phải xử lý phiếu.

Ô hạn trong user story để trống. Không bịa số giờ. Chỉ có các mốc đã viết chữ: nhắc báo cáo 30/14/7/3 ngày, hạn giải trình 14 ngày, nhắc ngày 10 và 13.

## Ngưỡng đấu thầu và giao nhiều lần

Việc này là tự đấu thầu khi vượt một mức tiền, và nhận hàng từng đợt.

Không có mức tiền và không có bước giao một phần. Phiếu chỉ ghi mua trực tiếp hoặc đấu thầu. Chủ nhiệm xác nhận nhận một lần.

## Cổng ký số

Việc này là ký qua nhà cung cấp chữ ký số.

Chưa có nhà cung cấp. Hiện là bấm xác nhận. File scan không bắt buộc.

## Quyết định công nhận tách khỏi thanh lý

Việc này là một vòng ký riêng, xong mới `HOAN_THANH`.

Luồng chính chỉ có BM.14. `HOAN_THANH` khi chủ nhiệm xác nhận thanh lý. `recognitionFileUrl` đính kèm được, không chặn trạng thái, vì chưa có mẫu và chưa có vòng ký riêng.

## Thu hồi số tiền còn thừa

Việc này là lập phiếu thu hoặc chuyển khoản khi đã cấp nhiều hơn số quyết toán.

BM.14 chỉ ghi số tồn và lựa chọn `HOAN_TRA` hoặc `KHONG_PHAT_SINH`. Không có phiếu thu, không có bước chuyển khoản.
