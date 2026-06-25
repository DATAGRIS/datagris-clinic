import { NextRequest, NextResponse } from 'next/server';
import { executeQueryAsAdmin } from '@/lib/db';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { clinicId, clinicName, mobile, username } = await req.json();

    if (!clinicId || !clinicName || !mobile || !username) {
      return NextResponse.json({ error: 'Missing activation request details' }, { status: 400 });
    }

    const logDetails = `طلب تفعيل API الواتساب لخطة برو. اسم العيادة: ${clinicName}، المعرف: ${clinicId}، اسم المستخدم: ${username}، هاتف الواتساب: ${mobile}`;
    
    // 1. Log request in Supabase Audit Logs
    try {
      await executeQueryAsAdmin(
        `INSERT INTO audit_logs (clinic_id, username, action, details) VALUES (?, ?, ?, ?)`,
        [clinicId, username, 'WHATSAPP_ACTIVATION_REQUEST', logDetails],
        'run'
      );
    } catch (dbErr: any) {
      console.error('Failed to write to audit_logs:', dbErr.message);
    }

    // 2. Dispatch Email notification to datagris.clinic@gmail.com
    const emailUser = process.env.EMAIL_USER || '';
    const emailPass = process.env.EMAIL_PASS || '';
    
    let emailSent = false;
    let emailInfo = 'Simulated email log (SMTP credentials missing)';

    if (emailUser && emailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });

        const mailOptions = {
          from: emailUser,
          to: 'datagris.clinic@gmail.com',
          subject: `🔔 طلب تفعيل واتساب للعميل - ${clinicName}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">طلب تفعيل API الواتساب لخطط Pro</h2>
              <p style="font-size: 16px;">قام عميل جديد بالاشتراك في باقة البرو ويطلب تفعيل الـ API الخاص به.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">اسم العيادة:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${clinicName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">معرف العيادة (Clinic ID):</td>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #2563eb;">${clinicId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">اسم المستخدم:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">رقم هاتف الواتساب المطلوب تفعيله:</td>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${mobile}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">تاريخ الطلب:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString('ar-EG')}</td>
                </tr>
              </table>
              <div style="margin-top: 25px; background-color: #f9fafb; padding: 15px; border-radius: 5px; border: 1px dashed #d1d5db;">
                <strong>الخطوات المطلوبة للشركة:</strong>
                <ol>
                  <li>ربط رقم الهاتف الخاص بالعميل في بوابة الإرسال الخاصة بكم.</li>
                  <li>توليد كود الـ QR وإرساله للعميل على هاتفه المذكور أعلاه ليقوم بمسحه وتأكيد الربط.</li>
                  <li>بمجرد حصولكم على الـ API Key، قوموا بإضافته مباشرة في Supabase تحت إعدادات عيادته بـ key = <code>whatsappApiKey</code> و <code>whatsappApiUrl</code>.</li>
                  <li>سيتعرف النظام عليه تلقائياً ويبدأ الإرسال الفوري.</li>
                </ol>
              </div>
            </div>
          `
        };

        const info = await transporter.sendMail(mailOptions);
        emailSent = true;
        emailInfo = `Email sent: ${info.messageId}`;
        console.log('Email sent successfully:', info.messageId);
      } catch (mailErr: any) {
        console.error('Nodemailer send failed:', mailErr.message);
        emailInfo = `Mail error: ${mailErr.message}`;
      }
    } else {
      console.log('--- SIMULATED EMAIL TO datagris.clinic@gmail.com ---');
      console.log(`Subject: 🔔 طلب تفعيل واتساب للعميل - ${clinicName}`);
      console.log(logDetails);
      console.log('----------------------------------------------------');
    }

    return NextResponse.json({ success: true, emailSent, info: emailInfo });
  } catch (err: any) {
    console.error('Request activation route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
