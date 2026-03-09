/**
 * Cấu hình thông báo validation tiếng Việt (áp dụng toàn cục)
 * Load trước app qua preloads trong adonisrc.ts
 */
import vine, { SimpleMessagesProvider } from '@vinejs/vine'

vine.messagesProvider = new SimpleMessagesProvider(
  {
    required: 'Trường {{ field }} là bắt buộc.',
    string: '{{ field }} phải là chuỗi.',
    email: 'Email không hợp lệ.',
    'email.email': 'Vui lòng nhập đúng định dạng email.',
    'string.minLength': '{{ field }} phải có ít nhất {{ min }} ký tự.',
    'password.minLength': 'Mật khẩu phải có ít nhất 8 ký tự.',
    'confirmPassword.minLength': 'Mật khẩu xác nhận phải có ít nhất 8 ký tự.',
    sameAs: '{{ field }} phải khớp với {{ otherField }}.',
    'confirmPassword.sameAs': 'Mật khẩu xác nhận không khớp với mật khẩu.',
  },
  {
    email: 'Email',
    password: 'Mật khẩu',
    confirmPassword: 'Mật khẩu xác nhận',
  }
)
