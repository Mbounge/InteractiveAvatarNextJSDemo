import { NextResponse } from "next/server";
import sendgrid from "@sendgrid/mail";

// Set SendGrid API Key
sendgrid.setApiKey(process.env.SEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Extract email details from the request body
    const { subject, user_info, chat_history, to_email } = body;

    // Send the email
    await sendgrid.send({
      to: to_email, // Recipient email
      from: "bo@graet.com", // Verified sender email
      subject: subject,
      text: `User Info:\n${user_info}\n\nChat History:\n${chat_history}`,
      html: `
        <h1>${subject}</h1>
        <p><strong>User Info:</strong></p>
        <pre>${user_info}</pre>
        <p><strong>Chat History:</strong></p>
        <pre>${chat_history}</pre>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

