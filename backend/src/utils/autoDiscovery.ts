export interface DiscoveredConfig {
  provider: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  notes?: string;
}

const KNOWN_PROVIDERS: Record<string, DiscoveredConfig> = {
  'gmail.com': {
    provider: 'GMAIL',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    notes: 'Google OAuth2 is recommended instead of app passwords.',
  },
  'googlemail.com': {
    provider: 'GMAIL',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  'outlook.com': {
    provider: 'OUTLOOK',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    notes: 'Microsoft 365 OAuth2 is recommended.',
  },
  'hotmail.com': {
    provider: 'OUTLOOK',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
  },
  'icloud.com': {
    provider: 'ICLOUD',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecure: false,
    notes: 'Requires an Apple App-Specific Password.',
  },
  'me.com': {
    provider: 'ICLOUD',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecure: false,
  },
  'yahoo.com': {
    provider: 'YAHOO',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
    smtpSecure: true,
    notes: 'Requires a Yahoo App Password or OAuth.',
  },
  'zoho.com': {
    provider: 'ZOHO',
    imapHost: 'imappro.zoho.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtppro.zoho.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  'fastmail.com': {
    provider: 'FASTMAIL',
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  'rediffmail.com': {
    provider: 'OTHER',
    imapHost: 'imap.rediffmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.rediffmail.com',
    smtpPort: 587,
    smtpSecure: false,
  },
};

const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const HOST_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function discoverEmailSettings(emailAddress: string): Promise<DiscoveredConfig> {
  const parts = emailAddress.split('@');
  if (parts.length !== 2) {
    throw new Error('Invalid email address format.');
  }

  const domain = parts[1].toLowerCase().trim();

  // Validate domain format to prevent path traversal or injection in autoconfig lookup
  if (!DOMAIN_REGEX.test(domain)) {
    throw new Error('Invalid email address domain format.');
  }

  // Check known presets
  if (KNOWN_PROVIDERS[domain]) {
    return KNOWN_PROVIDERS[domain];
  }

  // Attempt Mozilla ISPDB lookups via fetch if available
  try {
    const ispdbUrl = `https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(ispdbUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const xmlText = await res.text();
      // Extract imap and smtp servers from xml
      const imapHostMatch = xmlText.match(/<incomingServer type="imap">[\s\S]*?<hostname>(.*?)<\/hostname>/i);
      const imapPortMatch = xmlText.match(/<incomingServer type="imap">[\s\S]*?<port>(.*?)<\/port>/i);
      const smtpHostMatch = xmlText.match(/<outgoingServer type="smtp">[\s\S]*?<hostname>(.*?)<\/hostname>/i);
      const smtpPortMatch = xmlText.match(/<outgoingServer type="smtp">[\s\S]*?<port>(.*?)<\/port>/i);

      if (imapHostMatch && smtpHostMatch) {
        const imapHost = imapHostMatch[1].trim();
        const smtpHost = smtpHostMatch[1].trim();

        // Validate returned hostnames from XML
        if (HOST_REGEX.test(imapHost) && HOST_REGEX.test(smtpHost)) {
          const imapPort = parseInt(imapPortMatch ? imapPortMatch[1] : '993', 10);
          const smtpPort = parseInt(smtpPortMatch ? smtpPortMatch[1] : '587', 10);
          return {
            provider: 'IMAP_SMTP',
            imapHost,
            imapPort: isNaN(imapPort) ? 993 : imapPort,
            imapSecure: imapPort === 993,
            smtpHost,
            smtpPort: isNaN(smtpPort) ? 587 : smtpPort,
            smtpSecure: smtpPort === 465,
            notes: 'Discovered via Mozilla ISPDB autoconfiguration.',
          };
        }
      }
    }
  } catch {
    // If ISPDB fails or times out, fallback to conventional domain defaults
  }

  // Default fallback convention: mail.domain.com
  return {
    provider: 'IMAP_SMTP',
    imapHost: `mail.${domain}`,
    imapPort: 993,
    imapSecure: true,
    smtpHost: `mail.${domain}`,
    smtpPort: 587,
    smtpSecure: false,
    notes: 'Default server guess based on domain convention.',
  };
}
