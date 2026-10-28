import { describe, expect, it, vi } from "vitest";

import { createSmtpSender, type SmtpTransport } from "./smtp";

const message = {
  to: "maker@example.com",
  subject: "Verify your email",
  text: "Open the link",
  html: "<p>Open the link</p>",
  tag: "email-verification",
};

describe("createSmtpSender", () => {
  it("sends the message from the configured address", async () => {
    const sendMail = vi.fn<SmtpTransport["sendMail"]>().mockResolvedValue({});
    await createSmtpSender({ sendMail }, "dodoi <dodoi.test@gmail.com>").send(message);
    expect(sendMail).toHaveBeenCalledWith({
      from: "dodoi <dodoi.test@gmail.com>",
      to: "maker@example.com",
      subject: "Verify your email",
      text: "Open the link",
      html: "<p>Open the link</p>",
    });
  });

  it("throws when the server rejects it", async () => {
    const sendMail = vi
      .fn<SmtpTransport["sendMail"]>()
      .mockRejectedValue(new Error("Invalid login: 535 Username and Password not accepted"));
    await expect(createSmtpSender({ sendMail }, "dodoi <a@b.c>").send(message)).rejects.toThrow(
      /SMTP rejected the email: Invalid login/,
    );
  });
});
