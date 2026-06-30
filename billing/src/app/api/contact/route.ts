import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { name, email, mobile, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'الرجاء إدخال الاسم، البريد الإلكتروني، ونص الرسالة' }, { status: 400 });
    }

    const emailUser = process.env.EMAIL_USER || '';
    const emailPass = process.env.EMAIL_PASS || '';

    if (!emailUser || !emailPass) {
      console.error('Nodemailer SMTP configurations (EMAIL_USER, EMAIL_PASS) are missing on the server.');
      return NextResponse.json({ error: 'خادم البريد الإلكتروني غير مهيأ حالياً' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const mailOptions = {
      from: emailUser,
      to: 'support@datagris.com, datagric.clinic@gmail.com',
      subject: `✉️ رسالة جديدة من صفحة اتصل بنا - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; direction: rtl; text-align: right;">
          <h2 style="color: #2f5daa; border-bottom: 2px solid #2f5daa; padding-bottom: 10px;">رسالة تواصل جديدة</h2>
          <p style="font-size: 16px;">وصلتك رسالة جديدة من نموذج "اتصل بنا" في صفحة البيلينج.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; direction: rtl; text-align: right;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 150px;">الاسم الكامل:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">البريد الإلكتروني:</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #2f5daa;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">رقم الهاتف:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${mobile || 'غير محدد'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">تاريخ الرسالة:</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString('ar-EG')}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-right: 4px solid #2f5daa; border-radius: 4px;">
            <strong style="display: block; margin-bottom: 8px;">محتوى الرسالة:</strong>
            <p style="white-space: pre-wrap; margin: 0; line-height: 1.5; font-size: 15px; color: #374151;">${message}</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Contact API endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
