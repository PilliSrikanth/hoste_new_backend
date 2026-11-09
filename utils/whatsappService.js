const axios = require("axios");


// ======================================================
// 📱 SEND WHATSAPP OTP
// ======================================================

const sendWhatsAppOtp = async (phoneNumber, otp) => {

  const graphVersion =
    process.env.WA_GRAPH_VERSION;

  const phoneNumberId =
    process.env.WA_PHONE_NUMBER_ID;

  const accessToken =
    process.env.WA_ACCESS_TOKEN;

  const templateName =
    process.env.WA_OTP_TEMPLATE;

  const language =
    process.env.WA_TEMPLATE_LANGUAGE || "en_US";


  // ==========================================
  // CHECK CONFIGURATION
  // ==========================================

  if (
    !graphVersion ||
    !phoneNumberId ||
    !accessToken ||
    !templateName
  ) {

    throw new Error(
      "WhatsApp API configuration is incomplete"
    );

  }


  // ==========================================
  // META GRAPH API URL
  // ==========================================

  const url =
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;


  // ==========================================
  // WHATSAPP TEMPLATE
  // ==========================================

  const payload = {

    messaging_product:
      "whatsapp",

    to:
      phoneNumber,

    type:
      "template",

    template: {

      name:
        templateName,

      language: {

        code:
          language

      },

      components: [

        {

          type:
            "body",

          parameters: [

            {

              type:
                "text",

              text:
                String(otp)

            }

          ]

        }

      ]

    }

  };


  // ==========================================
  // SEND REQUEST
  // ==========================================

  const response =
    await axios.post(

      url,

      payload,

      {

        headers: {

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json"

        }

      }

    );


  return response.data;

};


module.exports = {

  sendWhatsAppOtp

};