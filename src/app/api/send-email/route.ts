import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { toEmail, subject, textBody } = await req.json();

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return Response.json(
        { error: 'Kredensial email (EMAIL_USER / EMAIL_PASS) belum diatur di Vercel.' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Referee AI Assistant" <${user}>`,
      to: toEmail,
      subject: subject,
      text: textBody,
    });

    return Response.json({ success: true, message: 'Email berhasil dikirim' });
  } catch (error: any) {
    console.error('[Email Error]', error);
    return Response.json({ error: 'Gagal mengirim email', details: String(error) }, { status: 500 });
  }
}
