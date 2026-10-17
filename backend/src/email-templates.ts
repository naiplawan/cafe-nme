export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

interface FormalEmailInput {
  subject: string;
  preheader: string;
  title: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  expiry?: string;
  securityNote?: string;
  logoUrl?: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function formalEmail(input: FormalEmailInput): EmailTemplate {
  const { action, expiry, greeting, logoUrl, paragraphs, preheader, securityNote, subject, title } = input;
  const actionText = action ? `${action.label}: ${action.url}` : '';
  const text = [
    greeting,
    ...paragraphs,
    actionText,
    expiry,
    securityNote,
    'ขอแสดงความนับถือ',
    "ทีมงาน Cafe'nMe",
  ].filter((line): line is string => Boolean(line)).join('\n\n');
  const actionHtml = action
    ? `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:28px auto"><tr><td align="center" bgcolor="#65452f" style="border-radius:6px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 26px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none">${escapeHtml(action.label)}</a></td></tr></table><p style="margin:0 0 8px;color:#6f6258;font-size:13px;line-height:1.7">หากปุ่มไม่สามารถเปิดได้ กรุณาคัดลอกที่อยู่นี้ไปวางในเบราว์เซอร์:</p><p style="margin:0 0 24px;overflow-wrap:anywhere;color:#6f6258;font-size:12px;line-height:1.7">${escapeHtml(action.url)}</p>`
    : '';
  const detailHtml = [expiry, securityNote]
    .filter((line): line is string => Boolean(line))
    .map((line) => `<p style="margin:0 0 12px;color:#6f6258;font-size:13px;line-height:1.7">${escapeHtml(line)}</p>`)
    .join('');
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="112" height="112" alt="Cafe'nMe" style="display:block;width:112px;height:112px;margin:0 0 10px;border:0">`
    : '';
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background-color:#f5f1eb;color:#30251e;font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f5f1eb" style="width:100%;background-color:#f5f1eb"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e7ddd2"><tr><td style="padding:28px 36px 18px;border-bottom:1px solid #eee7df">${logoHtml}<p style="margin:0;color:#65452f;font-family:Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:.3px">Cafe'nMe</p><p style="margin:5px 0 0;color:#8b7766;font-size:11px;letter-spacing:1.5px">ACCOUNT SERVICES</p></td></tr><tr><td style="padding:34px 36px 38px"><h1 style="margin:0 0 24px;color:#30251e;font-size:22px;line-height:1.45;font-weight:700">${escapeHtml(title)}</h1><p style="margin:0 0 16px;color:#30251e;font-size:15px;line-height:1.8">${escapeHtml(greeting)}</p>${paragraphs.map((paragraph) => `<p style="margin:0 0 16px;color:#4c4037;font-size:15px;line-height:1.8">${escapeHtml(paragraph)}</p>`).join('')}${actionHtml}${detailHtml}<p style="margin:26px 0 4px;color:#4c4037;font-size:14px;line-height:1.8">ขอแสดงความนับถือ</p><p style="margin:0;color:#4c4037;font-size:14px;line-height:1.8">ทีมงาน Cafe'nMe</p></td></tr><tr><td style="padding:18px 36px;background-color:#faf8f5;border-top:1px solid #eee7df"><p style="margin:0;color:#8b7766;font-size:11px;line-height:1.7">อีเมลฉบับนี้จัดส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export function verificationEmail(url: string, logoUrl?: string): EmailTemplate {
  return formalEmail({
    subject: "ยืนยันที่อยู่อีเมลสำหรับบัญชี Cafe'nMe",
    preheader: 'กรุณายืนยันที่อยู่อีเมลเพื่อเปิดใช้งานบัญชี Cafe\'nMe',
    title: 'โปรดยืนยันที่อยู่อีเมล',
    logoUrl,
    greeting: 'เรียน ท่านผู้สมัคร',
    paragraphs: ["ขอขอบพระคุณที่สมัครใช้บริการ Cafe'nMe กรุณายืนยันที่อยู่อีเมลของท่านเพื่อเปิดใช้งานบัญชีและเริ่มต้นใช้งานระบบ"],
    action: { label: 'ยืนยันที่อยู่อีเมล', url },
    expiry: 'ลิงก์ยืนยันนี้มีอายุ 24 ชั่วโมง',
    securityNote: 'หากท่านไม่ได้เป็นผู้สมัครบัญชีนี้ สามารถละเว้นอีเมลฉบับนี้ได้ บัญชีจะยังไม่เปิดใช้งาน',
  });
}

export function welcomeEmail(url: string, logoUrl?: string): EmailTemplate {
  return formalEmail({
    subject: "ยืนยันบัญชี Cafe'nMe สำเร็จ",
    preheader: 'บัญชี Cafe\'nMe ของท่านพร้อมใช้งานแล้ว',
    title: 'ยืนยันบัญชีเรียบร้อยแล้ว',
    logoUrl,
    greeting: 'เรียน ท่านผู้ใช้บริการ',
    paragraphs: ["ที่อยู่อีเมลของท่านได้รับการยืนยันแล้ว บัญชี Cafe'nMe พร้อมใช้งาน ท่านสามารถเข้าสู่ระบบเพื่อดำเนินการต่อได้"],
    action: { label: 'เข้าสู่ระบบ', url },
  });
}

export function passwordResetEmail(url: string, logoUrl?: string): EmailTemplate {
  return formalEmail({
    subject: "คำขอตั้งรหัสผ่านใหม่สำหรับ Cafe'nMe",
    preheader: 'ใช้ลิงก์ที่ปลอดภัยเพื่อตั้งรหัสผ่านใหม่',
    title: 'ตั้งรหัสผ่านใหม่',
    logoUrl,
    greeting: 'เรียน ท่านผู้ใช้บริการ',
    paragraphs: ["เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี Cafe'nMe ของท่าน เลือกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่"],
    action: { label: 'ตั้งรหัสผ่านใหม่', url },
    expiry: 'ลิงก์นี้มีอายุ 30 นาทีและใช้ได้เพียงครั้งเดียว',
    securityNote: 'หากท่านไม่ได้เป็นผู้ร้องขอ สามารถละเว้นอีเมลฉบับนี้ได้ รหัสผ่านเดิมของท่านจะยังคงใช้งานได้',
  });
}

export function passwordChangedEmail(url: string, logoUrl?: string): EmailTemplate {
  return formalEmail({
    subject: "แจ้งการเปลี่ยนรหัสผ่านบัญชี Cafe'nMe",
    preheader: 'รหัสผ่านบัญชี Cafe\'nMe ของท่านได้รับการเปลี่ยนแล้ว',
    title: 'รหัสผ่านได้รับการเปลี่ยนแล้ว',
    logoUrl,
    greeting: 'เรียน ท่านผู้ใช้บริการ',
    paragraphs: ["ระบบได้เปลี่ยนรหัสผ่านบัญชี Cafe'nMe ของท่านเรียบร้อยแล้ว เพื่อความปลอดภัย เซสชันการใช้งานเดิมทั้งหมดได้ถูกยกเลิก"],
    action: { label: 'หากไม่ใช่ท่าน โปรดรีเซ็ตรหัสผ่าน', url },
    securityNote: 'หากท่านเป็นผู้ดำเนินการ ไม่จำเป็นต้องดำเนินการเพิ่มเติม',
  });
}
