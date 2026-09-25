# Cold Chain Telemetry System

Hệ thống quản lý và giám sát chuỗi lạnh theo thời gian thực. Ứng dụng theo dõi kho lạnh, xe vận chuyển, thiết bị IoT, dữ liệu nhiệt độ/độ ẩm và cảnh báo khi nhiệt độ vượt vùng an toàn.

## Tính năng chính

- Dashboard tổng quan số lượng kho, xe, thiết bị, cảnh báo và tỷ lệ tuân thủ nhiệt độ.
- Quản lý kho lạnh: danh sách, tìm kiếm, chi tiết, thiết bị và xe trực thuộc.
- Quản lý xe vận chuyển lạnh và lịch sử telemetry.
- Quản lý thiết bị IoT, trạng thái và lịch sử đo.
- Tiếp nhận telemetry nhiệt độ/độ ẩm.
- Mô phỏng dữ liệu IoT và tự động tạo cảnh báo excursion.
- Quản lý cảnh báo nhiệt độ cao/thấp.
- Đăng nhập bằng JWT và phân quyền ADMIN, MANAGER, STAFF/USER.
- Báo cáo telemetry, biểu đồ, packet inspector và xuất nhật ký xe ra CSV.
- Modal cài đặt ngưỡng nhiệt độ, đổi mật khẩu và các thao tác hỗ trợ vận hành.

## Công nghệ sử dụng

### Backend

- Node.js
- Express.js
- PostgreSQL
- pg
- JWT (`jsonwebtoken`)
- bcryptjs
- CORS

### Frontend

- HTML5, CSS3, JavaScript thuần
- Chart.js
- Fetch API
- Responsive layout cho desktop và mobile

## Cấu trúc dự án

```text
ColdChainTelemetrySystem/
├── BA/                         # Tài liệu phân tích và sơ đồ nghiệp vụ
├── backend/
│   ├── app.js                  # Express server và route chính
│   ├── db.js                   # Kết nối PostgreSQL
│   ├── schema.sql              # Schema và dữ liệu seed cơ bản
│   ├── seed-warehouses.js      # Seed thêm thiết bị/kho và telemetry
│   ├── controllers/            # Xử lý nghiệp vụ API
│   ├── routes/                 # Khai báo API routes
│   └── package.json
├── design-references/          # Tài liệu/tham khảo thiết kế
├── frontend/
│   ├── login.html
│   ├── dashboard.html
│   ├── pages/                  # Các trang nghiệp vụ
│   ├── js/                     # Logic giao diện và API client
│   ├── css/                    # Stylesheet
│   └── assets/
├── QA/
│   └── Cold_Chain_QA_Test.docx # Kế hoạch và danh sách test case QA
└── README.md
```

## Yêu cầu môi trường

- Node.js 18 trở lên
- npm
- PostgreSQL 14 trở lên
- Trình duyệt hiện đại: Google Chrome, Microsoft Edge hoặc Firefox

## Cài đặt và chạy dự án

### 1. Tạo database PostgreSQL

Tạo một database mới, ví dụ:

```sql
CREATE DATABASE cold_chain_telemetry;
```

Sau đó chạy schema và dữ liệu seed:

```powershell
psql -U postgres -d cold_chain_telemetry -f .\backend\schema.sql
```

> Nếu PostgreSQL yêu cầu mật khẩu hoặc `psql` chưa có trong PATH, hãy chạy lệnh bằng SQL Shell (psql) hoặc thêm thư mục `bin` của PostgreSQL vào PATH.

### 2. Cấu hình biến môi trường

Tạo file `backend/.env`:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=cold_chain_telemetry

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
```

Không commit file `.env` hoặc mật khẩu thật vào repository.

### 3. Cài dependencies

```powershell
Set-Location .\backend
npm install
```

### 4. Khởi động server

Chạy production-like server:

```powershell
npm start
```

Chạy development server với nodemon:

```powershell
npm run dev
```

Server mặc định chạy tại:

- Frontend: http://localhost:3000
- Login: http://localhost:3000/login.html
- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health

## Seed dữ liệu bổ sung

Sau khi chạy `schema.sql`, có thể chạy seed bổ sung cho thiết bị kho lạnh và telemetry:

```powershell
Set-Location .\backend
node .\seed-warehouses.js
```

Dữ liệu mẫu mặc định gồm:

- 5 kho lạnh
- 10 xe vận chuyển
- 24 thiết bị IoT
- 29 bản ghi telemetry
- 4 tài khoản demo

## Tài khoản demo

| Username | Password | Role | Quyền |
|---|---|---|---|
| `admin` | `admin123` | ADMIN | Toàn quyền, gồm xóa và mô phỏng telemetry |
| `manager` | `manager123` | MANAGER | Xem, tạo và cập nhật dữ liệu nghiệp vụ |
| `user` | `user123` | USER | Quyền xem; được hiển thị như Staff trên UI |
| `staff` | `staff123` | STAFF | Quyền xem |

Các mật khẩu trên chỉ dành cho môi trường demo/local. Hãy thay đổi trước khi triển khai thực tế.

## API chính

Base URL: `http://localhost:3000/api`

### Authentication

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/auth/login` | Đăng nhập và nhận JWT |
| `GET` | `/auth/me` | Lấy user hiện tại, cần Bearer token |
| `PUT` | `/auth/change-password` | Đổi mật khẩu, cần Bearer token |

### Kho, xe và thiết bị

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/warehouses` | Danh sách/lọc kho lạnh |
| `GET` | `/warehouses/:id` | Chi tiết kho |
| `POST/PUT/DELETE` | `/warehouses` hoặc `/warehouses/:id` | Tạo, sửa, xóa kho |
| `GET` | `/vehicles` | Danh sách/lọc xe |
| `GET` | `/vehicles/:id` | Chi tiết xe và telemetry |
| `POST/PUT/DELETE` | `/vehicles` hoặc `/vehicles/:id` | Tạo, sửa, xóa xe |
| `GET` | `/devices` | Danh sách/lọc thiết bị |
| `GET` | `/devices/:id` | Chi tiết và lịch sử thiết bị |
| `POST/PUT/DELETE` | `/devices` hoặc `/devices/:id` | Đăng ký, sửa, xóa thiết bị |

### Telemetry và cảnh báo

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/data/summary` | Số liệu cho Dashboard |
| `GET` | `/data` | Danh sách telemetry, filter và pagination |
| `GET` | `/data/device/:deviceId` | Lịch sử telemetry của thiết bị |
| `POST` | `/data` | Ghi nhận telemetry mới |
| `POST` | `/data/simulate` | Mô phỏng telemetry, chỉ ADMIN |
| `GET` | `/alerts` | Danh sách cảnh báo |
| `GET` | `/alerts/:id` | Chi tiết cảnh báo |
| `POST` | `/alerts` | Tạo cảnh báo |
| `DELETE` | `/alerts/:id` | Xử lý/xóa cảnh báo |

Ví dụ đăng nhập bằng PowerShell:

```powershell
$body = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" `
  -Body $body
```

Ví dụ gửi telemetry trong vùng an toàn:

```powershell
$token = "PASTE_JWT_TOKEN_HERE"
$body = @{
  device_id = 1
  temperature = 5.5
  humidity = 75
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/data" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body
```

Nhiệt độ an toàn là từ `2.0°C` đến `8.0°C`. Giá trị dưới `2.0°C` hoặc trên `8.0°C` sẽ tạo cảnh báo tự động khi ghi telemetry.

## Phân quyền

- GET các danh sách và chi tiết: không bắt buộc đăng nhập.
- MANAGER: được tạo/cập nhật kho, xe, thiết bị, telemetry và cảnh báo.
- ADMIN: có toàn quyền, bao gồm xóa dữ liệu và mô phỏng telemetry.
- STAFF/USER: chủ yếu có quyền xem.
- API protected sử dụng header:

```text
Authorization: Bearer <JWT_TOKEN>
```

## Các trang giao diện

| Trang | URL |
|---|---|
| Login | `/login.html` |
| Dashboard | `/dashboard.html` |
| Warehouses | `/pages/warehouses.html` |
| Warehouse detail | `/pages/warehouses-detail.html?id=1` |
| Vehicles | `/pages/vehicles.html` |
| Vehicle detail | `/pages/vehicles-detail.html?id=1` |
| Devices | `/pages/devices.html` |
| Device detail | `/pages/devices-detail.html?id=1` |
| Telemetry / Reports | `/pages/reports.html` |
| Alerts | `/pages/alerts.html` |

## Kiểm thử

Tài liệu test case chi tiết nằm tại [QA/Cold_Chain_QA_Test.docx](QA/Cold_Chain_QA_Test.docx), bao gồm:

- Kiểm thử API bằng Postman.
- Kiểm thử UI bằng Chrome DevTools.
- Kiểm thử JWT và phân quyền.
- Kiểm thử nhiệt độ biên và tự động tạo cảnh báo.
- Mẫu Bug Report và tiêu chí nghiệm thu.

Hiện backend chưa khai báo script test tự động trong `package.json`. Có thể kiểm tra nhanh server bằng:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

## Lưu ý phát triển

- Backend đang phục vụ frontend static bằng Express nên không cần chạy frontend dev server riêng.
- Database sử dụng PostgreSQL, không phải SQLite.
- Schema hiện dùng ID do ứng dụng tự sinh bằng `MAX(id) + 1`; khi kiểm thử đồng thời cần chú ý nguy cơ trùng ID.
- Một số thông tin hiển thị trên UI như RSSI, pin, tuyến đường hoặc dữ liệu chart có thể là dữ liệu mô phỏng phục vụ demo.
- Không dùng tài khoản và JWT secret mặc định trong môi trường production.

## License

Dự án phục vụ mục đích học tập, minh họa và phát triển nội bộ. Chưa khai báo license phát hành công khai.
