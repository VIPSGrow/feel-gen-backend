function detectLanguage(rawText = "") {
  const t = String(rawText);
  const hasHindi = /[\u0900-\u097F]/.test(t);
  return hasHindi ? "hi" : "en";
}

function answerFromFAQ({ contextRole, lang, text }) {
  const t = (text || "").trim().toLowerCase();

  const EN = [
    {
      q: /become.*feel safe sakhi|how can i become/i,
      a: "You can join by clicking the 'Register' button on our website or app, filling in your basic details, and choosing your preferred business level (Level 1, 2, or 3).",
    },
    {
      q: /documents.*registration|kyc.*documents|required.*documents/i,
      a: "You will need to upload self-attested copies of your Aadhaar Card, PAN Card, and a Cancelled Cheque or Bank Passbook to complete your KYC.",
    },
    {
      q: /joining fee|fee for registration|registration fee/i,
      a: 'No, there is absolutely no joining fee to partner with the company. Any payment made is strictly for the purchase of "FEEL SAFE" brand products.',
    },
    {
      q: /referral code/i,
      a: "A Referral Code is the unique ID of the person who introduced you to this scheme. Once the application is processed, the Referral Code cannot be changed.",
    },
    {
      q: /under the age of 21|21 years|minimum age/i,
      a: "According to the application form, a minimum age of 21 years is required to become a distributor.",
    },
    {
      q: /log in|login|sign in/i,
      a: "You can log in using your registered Mobile Number/User ID and Password. If you have forgotten your password, click on 'Forgot Password.'",
    },
    {
      q: /unable to log in|can\x27t log in|login problem/i,
      a: "First, check your internet connection. If the problem persists, please email us at support@feelsafeco.in or contact our helpline.",
    },

    {
      q: /special about.*sanitary pads|anion chip|is 5405/i,
      a: "Our pads adhere to IS 5405 standards. They feature Anion Chip technology and super absorbency, providing a 100% rash-free and hygienic experience.",
    },
    {
      q: /sell pads from other companies|competing brands|cannot.*compete/i,
      a: "While serving as a Feel Safe distributor, you are prohibited from engaging in the promotion or sale of any competing sanitary napkin brands.",
    },
    {
      q: /amazon|flipkart|e-commerce/i,
      a: "Selling products on e-commerce platforms without prior written consent from the company is strictly prohibited.",
    },

    {
      q: /different business levels|levels 1|level 2|level 3/i,
      a: "You can choose from three levels based on your business goals: Level 1 (Basic Sakhi): Initial start with a minimum order of ₹2,000. Level 2 (Professional Sakhi): Small business stock of ₹25,000. Level 3 (Master Sakhi/Distributor): Large-scale stockist at ₹1,00,000.",
    },
    {
      q: /change my level|upgrade my level/i,
      a: "Yes, you have the right to upgrade your level in the future based on your performance and financial capacity.",
    },
    {
      q: /fixed salary|salary/i,
      a: "No, you are an Independent Representative (IR). Your income is based solely on your actual sales performance.",
    },

    {
      q: /commission.*when|receive.*commission|commission processed/i,
      a: "Commissions are processed in the first week of the following month, only after the 30-day cooling-off period is complete.",
    },
    {
      q: /commission on cancelled|cancelled orders|returned.*commission/i,
      a: "No, commissions are not payable on orders that are returned, cancelled, or refunded within the 30-day cooling-off period.",
    },
    {
      q: /check.*team status|my tree|genealogy|team structure/i,
      a: "By logging in with your User ID, you can view your entire team structure and their sales details in the 'My Tree' or 'Genealogy' section.",
    },

    {
      q: /legally registered|consumer protection \(direct selling\) rules 2021/i,
      a: 'Yes, the company strictly adheres to the "Consumer Protection (Direct Selling) Rules, 2021" issued by the Government of India.',
    },
    {
      q: /field work|authorization letter|official id card|gloves/i,
      a: "You must always carry and display your Official ID Card and Authorization Letter. Additionally, you must wear hand gloves while handling products to maintain hygiene.",
    },
    {
      q: /company liable|risks during field work|accidents.*injuries/i,
      a: "Field activities are voluntary and performed at your own risk. The company is not legally or financially liable for any accidents or injuries incurred during field work.",
    },
    {
      q: /buy back|terminate within 30 days|stock if i stop/i,
      a: "If you terminate within 30 days, the company will buy back unsold stock that is in marketable condition under our Buy-Back Policy.",
    },
    {
      q: /men.*sakhi yojna|sakhi yojna.*men/i,
      a: 'No, men cannot work as part of the "Sakhi Yojna" as it is exclusively for women. However, they can become Distributors to sell products to local shops and retail outlets in their vicinity.',
    },
    {
      q: /demo kit|when is the demo kit|level 2 professional sakhi/i,
      a: "The Demo Kit is provided free of cost upon reaching 'Level 2: Professional Sakhi' (₹25,000 stock). It includes a bag, Feel brand pads, a 60ml syringe, color (for testing), and disposable hand gloves. Your Digital ID Card and Welcome Letter will be uploaded to your dashboard for you to print.",
    },
    {
      q: /work outside my allotted area|allotted area|appointed by the company/i,
      a: "You are required to get an area allotted during registration. However, you can work outside your allotted area as long as no other distributor has been appointed by the company in that specific location.",
    },
    {
      q: /part-time|part time/i,
      a: "Yes, the best part of Feel Safe Sakhi Yojna is that you can do it part-time along with your household chores or job.",
    },
    {
      q: /targets|mandatory targets/i,
      a: "The company has not imposed any mandatory targets. You can work according to your own will and capacity.",
    },
    {
      q: /expiry of feel safe pads|shelf life/i,
      a: "Our pads have a shelf life of 3 years from the date of manufacturing. Store them in a clean, dry place.",
    },
    {
      q: /change.*address|change.*phone number|edit profile/i,
      a: "Yes, you can submit an 'Edit Profile' request in your profile section, which will be updated after verification.",
    },
    {
      q: /delivery delayed|delayed delivery|support ticket|7 to 14/i,
      a: "If the order is not received within 7 to 14 working days, please raise a 'Support Ticket' in the App or check the tracking status of our logistics partner.",
    },
    {
      q: /training|webinars|offline meetings/i,
      a: "Yes, the company regularly conducts online webinars and offline meetings to provide product and sales training.",
    },
    {
      q: /change a nominee|nominee change|nominee/i,
      a: "You can update the nominee details in your account by sending a written request along with the new nominee’s ID proof.",
    },
  ];

  const HI = [
    {
      q: /मैं.*feel safe sakhi.*कैसे|feel safe sakhi कैसे बन/i,
      a: "आप हमारी वेबसाइट या ऐप पर 'पंजीकरण' (Register) बटन पर क्लिक करें, अपना मूल विवरण भरें और अपना पसंदीदा बिजनेस लेवल (लेवल 1, 2, या 3) चुनें।",
    },
    {
      q: /पंजीकरण.*दस्तावेज़|आधार|पैन|कैंसिल चेक|kyc/i,
      a: "आपको अपना आधार कार्ड, पैन कार्ड और एक कैंसिल चेक या बैंक पासबुक की स्व-सत्यापित प्रतियां (self-attested copies) अपलोड करनी होंगी।",
    },
    {
      q: /पंजीकरण.*शुल्क|जॉइनिंग फीस|फीस/i,
      a:
        "नहीं, कंपनी के साथ जुड़ने के लिए कोई पंजीकरण शुल्क नहीं है। कोई भी भुगतान केवल " +
        '"FEEL SAFE" ब्रांड के उत्पादों की खरीद के लिए है।',
    },
    {
      q: /रेफरल कोड/i,
      a: "रेफरल कोड उस व्यक्ति की विशिष्ट आईडी है जिसने आपको इस योजना से परिचित कराया है। एक बार पंजीकरण हो जाने के बाद, इसे बदला नहीं जा सकता।",
    },
    {
      q: /21 वर्ष से कम|न्यूनतम आयु|distributor बनने/i,
      a: "आवेदन पत्र के अनुसार, वितरक (Distributor) बनने के लिए न्यूनतम आयु 21 वर्ष होनी अनिवार्य है।",
    },
    {
      q: /लॉगिन|login|पासवर्ड भूल/i,
      a: "आप अपने पंजीकृत मोबाइल नंबर/यूजर आईडी और पासवर्ड का उपयोग करके लॉगिन कर सकती हैं। यदि आप पासवर्ड भूल गई हैं, तो 'Forgot Password' पर क्लिक करें।",
    },
    {
      q: /लॉगिन करने में असमर्थ|can't log in|internet connection|हेल्पलाइन|support@feelsafeco.in/i,
      a: "सबसे पहले अपना इंटरनेट कनेक्शन जांचें। यदि समस्या बनी रहती है, तो हमें support@feelsafeco.in पर ईमेल करें या हमारी हेल्पलाइन पर संपर्क करें।",
    },

    {
      q: /is 5405|एनिओन चिप|anion chip|सुपर एब्जॉर्बेंसी/i,
      a: "हमारे पैड्स IS 5405 मानकों का पालन करते हैं. इनमें एनिओन चिप (Anion Chip) तकनीक और सुपर एब्जॉर्बेंसी है, जो 100% रैश-मुक्त अनुभव प्रदान करती है।",
    },
    {
      q: /अन्य कंपनियों के पैड|प्रतिस्पर्धी|competing brands/i,
      a: "जब तक आप Feel Safe की वितरक हैं, आप किसी भी अन्य प्रतिस्पर्धी ब्रांड के सेनेटरी नैपकिन के प्रचार या बिक्री नहीं कर सकतीं।",
    },
    {
      q: /Amazon|Flipkart|ई-कॉमर्स/i,
      a: "कंपनी की पूर्व लिखित अनुमति के बिना ई-कॉमर्स प्लेटफॉर्म पर उत्पाद बेचना सख्त वर्जित है।",
    },

    {
      q: /लेवल 1|लेवल 2|लेवल 3|व्यवसाय स्तर/i,
      a: "आप अपने लक्ष्यों के आधार पर तीन स्तरों में से चुन सकती हैं: लेवल 1 (Basic Sakhi): न्यूनतम ₹2,000 के ऑर्डर के साथ शुरुआत. लेवल 2 (Professional Sakhi): ₹25,000 का स्टॉक. लेवल 3 (Master Sakhi/Distributor): ₹1,00,000 का बड़े स्तर का स्टॉक. ",
    },
    {
      q: /लेवल बदल|अपग्रेड/i,
      a: "हाँ, आपके पास अपने प्रदर्शन और वित्तीय क्षमता के आधार पर भविष्य में अपने स्तर को अपग्रेड करने का अधिकार है।",
    },
    {
      q: /निश्चित वेतन|fixed salary/i,
      a: "नहीं, आप एक स्वतंत्र प्रतिनिधि (Independent Representative) हैं. आपकी आय पूरी तरह से आपकी वास्तविक बिक्री प्रदर्शन पर आधारित है।",
    },

    {
      q: /कमीशन कब/i,
      a: "कमीशन अगले महीने के पहले सप्ताह में प्रोसेस किया जाता है, जो केवल 30 दिनों की कूलिंग-ऑफ अवधि पूरी होने के बाद ही संभव है।",
    },
    {
      q: /रद्द.*कमीशन|cancelled|returned|refund.*कमीशन/i,
      a: "नहीं, उन ऑर्डर्स पर कोई कमीशन देय नहीं है जो 30 दिनों के भीतर वापस, रद्द या रिफंड किए जाते हैं।",
    },
    {
      q: /My Tree|Genealogy|टीम की स्थिति/i,
      a: "अपनी यूजर आईडी के साथ लॉगिन करके, आप 'My Tree' या 'Genealogy' सेक्शन में अपनी पूरी टीम की संरचना और उनकी बिक्री विवरण देख सकती हैं।",
    },

    {
      q: /कानूनी रूप से पंजीकृत|consumer protection.*direct selling|2021/i,
      a: 'हाँ, कंपनी भारत सरकार द्वारा जारी "उपभोक्ता संरक्षण (प्रत्यक्ष बिक्री) नियम, 2021" का सख्ती से पालन करती है।',
    },
    {
      q: /फील्ड वर्क.*आधिकारिक आईडी|Authorization Letter|दस्ताने/i,
      a: "आपको हमेशा अपना आधिकारिक आईडी कार्ड और प्राधिकरण पत्र (Authorization Letter) साथ रखना चाहिए. साथ ही, स्वच्छता बनाए रखने के लिए उत्पादों को संभालते समय दस्ताने पहनना अनिवार्य है।",
    },
    {
      q: /कंपनी.*जिम्मेदार नहीं|accidents|injuries/i,
      a: "फील्ड गतिविधियाँ स्वैच्छिक हैं और आपके अपने जोखिम पर की जाती हैं. फील्ड वर्क के दौरान होने वाली किसी भी दुर्घटना या चोट के लिए कंपनी कानूनी या वित्तीय रूप से उत्तरदायी नहीं है।",
    },
    {
      q: /30 दिनों के भीतर काम बंद|buy back|स्टॉक/i,
      a: "यदि आप 30 दिनों के भीतर काम बंद करती हैं, तो कंपनी हमारी बाय-बैक पॉलिसी के तहत बेचने योग्य स्थिति में मौजूद बिना बिके स्टॉक को वापस खरीद लेगी।",
    },
    {
      q: /पुरुष.*सखी योजना|men.*sakhi yojna/i,
      a: 'नहीं, पुरुष "सखी योजना" का हिस्सा बनकर काम नहीं कर सकते क्योंकि यह विशेष रूप से महिलाओं के लिए है। हालांकि, वे Distributor बन सकते हैं और अपने आसपास की दुकानों या रिटेल काउंटरों पर उत्पाद बेचने के लिए काम कर सकते हैं।',
    },
    {
      q: /डेमो किट|Demo Kit/i,
      a: "डेमो किट 'Level 2: Professional Sakhi' (₹25,000 स्टॉक) पर बिल्कुल फ्री दी जाती है। इसमें एक बैग, फील (Feel) ब्रांड के पैड्स, एक 60ml सिरिंज, कलर (टेस्ट के लिए), और डिस्पोजेबल हैंड ग्लव्स शामिल होते हैं। आपका डिजिटल आईडी कार्ड और वेलकम लेटर आपके डैशबोर्ड पर अपलोड कर दिया जाएगा, जिसे आप खुद प्रिंट करवा सकते हैं।",
    },
    {
      q: /अलॉटेड एरिया|allotted area|बाहर काम/i,
      a: "पंजीकरण के समय आपको अपना एरिया अलॉट करवाना होता है। हालांकि, आप अपने अलॉटेड एरिया के बाहर भी तब तक काम कर सकते हैं जब तक कि उस दूसरी जगह पर Feel Safe Company का कोई अपना अधिकृत वितरक (Distributor) नियुक्त नहीं हो जाता।",
    },
    {
      q: /पार्ट-टाइम/i,
      a: "हाँ, फील सेफ सखी योजना की सबसे अच्छी बात यह है कि आप इसे अपने घर के कामकाज या नौकरी के साथ पार्ट-टाइम भी कर सकती हैं।",
    },
    {
      q: /टारगेट|mandatory targets|निश्चित टारगेट/i,
      a: "कंपनी ने कोई अनिवार्य (Mandatory) टारगेट नहीं रखा है। आप अपनी इच्छा और क्षमता के अनुसार काम कर सकती हैं।",
    },
    {
      q: /एक्सपायरी|expiry|shelf life/i,
      a: "हमारे पैड्स की शेल्फ लाइफ निर्माण की तारीख (Date of Manufacturing) से 3 साल तक होती है। इन्हें सूखी और साफ जगह पर स्टोर करें।",
    },
    {
      q: /पता.*बदल|फोन नंबर.*बदल|Edit Profile/i,
      a: "हाँ, आप अपने प्रोफाइल सेक्शन में 'Edit Profile' रिक्वेस्ट सबमिट कर सकती हैं, जो वेरिफिकेशन के बाद अपडेट हो जाएगी।",
    },
    {
      q: /डिलीवरी.*देरी|7 to 14|Support Ticket/i,
      a: "यदि ऑर्डर 7 to 14 दिनों के भीतर प्राप्त नहीं होता है, तो कृपया ऐप में 'Support Ticket' रेज (Raise) करें या हमारे लॉजिस्टिक्स पार्टनर का ट्रैकिंग स्टेटस चेक करें।",
    },
    {
      q: /ट्रेनिंग|webinar|ऑफलाइन मीटिंग/i,
      a: "हाँ, कंपनी उत्पाद और बिक्री की ट्रेनिंग प्रदान करने के लिए नियमित रूप से ऑनलाइन वेबिनार और ऑफलाइन मीटिंग आयोजित करती है।",
    },
    {
      q: /नॉमिनी बदल/i,
      a: "आप एक लिखित अनुरोध के साथ नए नॉमिनी का आईडी प्रूफ भेजकर अपने अकाउंट में नॉमिनी का विवरण अपडेट करवा सकती हैं।",
    },
  ];

  const bank = lang === "hi" ? HI : EN;
  const found = bank.find((x) => x.q.test(t));
  return found ? found.a : null;
}

function formatMoney(v) {
  if (v === null || v === undefined) return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toFixed(2)}`;
}

function formatAssistantResponse({ context, intent, data, forbidden }) {
  const rawText = intent?.rawUserMessage || "";
  const lang = detectLanguage(rawText);
  const text = String(rawText || "");

  // FAQ override (official document content)
  const faq = answerFromFAQ({ contextRole: context.role, lang, text });
  if (faq) return faq;

  // Refund flow / delivery tracking policy
  const lc = text.toLowerCase();
  if (context.role === "ECOM_USER" && /refund/.test(lc)) {
    return lang === "hi"
      ? "रिफंड प्रक्रिया अभी उपलब्ध नहीं है।"
      : "Refund flow is not available yet.";
  }
  if (
    context.role === "ECOM_USER" &&
    /(delivery|track)/.test(lc) &&
    !data?.order
  ) {
    return lang === "hi"
      ? "अभी केवल ऑर्डर स्टेटस साझा किया जा सकता है (डिलीवरी ट्रैकिंग इवेंट्स उपलब्ध नहीं हैं)।"
      : "I can only share order status right now (delivery tracking events are not available yet).";
  }

  if (forbidden) {
    return lang === "hi"
      ? "आपको यह जानकारी देखने की अनुमति नहीं है।"
      : "You are not allowed to access that information.";
  }

  // Tool-based DB answers
  if (context.role === "ECOM_USER") {
    if (
      intent.toolName === "trackOrder" ||
      intent.toolName === "getOrderStatus"
    ) {
      const order = data?.order;
      if (!order) {
        return lang === "hi"
          ? "ऑर्डर नहीं मिला या उपलब्ध नहीं है। कृपया अपना ऑर्डर आईडी जांचें।"
          : "Order not found or not accessible. Please check your order ID.";
      }

      const payment = data?.payment || null;
      const paymentLine = payment
        ? `Payment: ${
            payment.status || order.payment_status || "-"
          } | Method: ${
            payment.payment_method || order.payment_method || "-"
          } | Transaction ID: ${payment.transaction_id || "-"}`
        : `Payment: ${order.payment_status || "-"} | Method: ${
            order.payment_method || "-"
          }`;

      return lang === "hi"
        ? `ऑर्डर ${order.order_id} की स्थिति '${order.order_status}' है। ${paymentLine}`
        : `Order ${order.order_id} is currently '${order.order_status}'. ${paymentLine}`;
    }

    if (intent.toolName === "getMyAddresses") {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0)
        return lang === "hi"
          ? "आपके पास कोई सेव्ड एड्रेस नहीं है।"
          : "You have no saved addresses.";
      const sample = rows[0];
      return lang === "hi"
        ? `आपके पास ${rows.length} सेव्ड एड्रेस हैं। डिफॉल्ट/लास्ट एड्रेस: ${
            sample?.address_line1 || "-"
          }, ${sample?.city || "-"}.`
        : `You have ${rows.length} saved address(es). Example: ${
            sample?.address_line1 || "-"
          }, ${sample?.city || "-"}.`;
    }

    if (intent.toolName === "getMyTickets") {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        return lang === "hi"
          ? "आपके कोई सपोर्ट टिकट नहीं हैं।"
          : "You have no support tickets.";
      }
      const latestTicket = rows[0];
      return lang === "hi"
        ? `आपके पास ${rows.length} टिकट हैं। सबसे नया टिकट है: '${latestTicket.subject}' (Status: ${latestTicket.status})`
        : `You have ${rows.length} ticket(s). The latest is: '${latestTicket.subject}' (Status: ${latestTicket.status})`;
    }

    if (intent.toolName === "getMyWishlist") {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0)
        return lang === "hi"
          ? "आपकी विशलिस्ट खाली है।"
          : "Your wishlist is empty.";
      return lang === "hi"
        ? `आपकी विशलिस्ट में ${rows.length} आइटम हैं।`
        : `Your wishlist has ${rows.length} item(s).`;
    }
  }

  if (context.role === "DISTRIBUTOR") {
    if (intent.toolName === "getWalletBalance") {
      if (!data)
        return lang === "hi" ? "वॉलेट नहीं मिला।" : "Wallet not found.";
      return lang === "hi"
        ? `वॉलेट बैलेंस: ${formatMoney(
            data.total_amount,
          )} | Pending: ${formatMoney(data.pending_amount)}`
        : `Wallet balance: ${formatMoney(
            data.total_amount,
          )}. Pending: ${formatMoney(data.pending_amount)}.`;
    }

    if (intent.toolName === "getDownlineCount") {
      return lang === "hi"
        ? `आपकी डाउनलाइन संख्या: ${data.downlineCount}`
        : `Your downline count is ${data.downlineCount}.`;
    }

    if (intent.toolName === "getLatestCommissions") {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0)
        return lang === "hi"
          ? "अभी तक कोई कमीशन ट्रांजैक्शन नहीं मिला।"
          : "No commission transactions found yet.";

      const first = rows[0];
      const header =
        lang === "hi"
          ? `लेटेस्ट कमीशन (${rows.length}):`
          : `Latest commission entries (${rows.length}):`;
      const line = first
        ? lang === "hi"
          ? ` ${formatMoney(first.amount)} | ${
              first.category || first.type || "-"
            } | Status: ${first.status || "-"} | Order: ${
              first.order_id || "-"
            } | ${first.created_at || ""}`
          : ` ${formatMoney(first.amount)} | ${
              first.category || first.type || "-"
            } | Status: ${first.status || "-"} | Order: ${
              first.order_id || "-"
            } | ${first.created_at || ""}`
        : "";

      return `${header}${line}`;
    }

    if (intent.toolName === "getMyTickets") {
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        return lang === "hi"
          ? "आपके कोई सपोर्ट टिकट नहीं हैं।"
          : "You have no support tickets.";
      }
      const latestTicket = rows[0];
      return lang === "hi"
        ? `आपके पास ${rows.length} टिकट हैं। सबसे नया टिकट है: '${latestTicket.subject}' (Status: ${latestTicket.status})`
        : `You have ${rows.length} ticket(s). The latest is: '${latestTicket.subject}' (Status: ${latestTicket.status})`;
    }
  }

  return lang === "hi"
    ? "मैं ऑर्डर स्टेटस (E-commerce) या वॉलेट/कमीशन (डिस्ट्रिब्यूटर्स) में मदद कर सकता/सकती हूँ।"
    : "I can help with order status (E-commerce) or wallet/commissions (Distributors).";
}

module.exports = { formatAssistantResponse };
