import { buildUrl } from "@/utils/buildUrl";
import { Html, Head, Main, NextScript } from "next/document";

// Dark is the default. This runs before first paint so there's no light flash;
// it only switches to light if the user explicitly chose it in Settings.
const THEME_BOOT = `try{if(localStorage.getItem("chatVRM_theme")==="light"){document.documentElement.classList.remove("dark")}}catch(e){}`;

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <meta name="color-scheme" content="dark light" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </Head>
      <body style={{ backgroundImage: `url(${buildUrl("/bg-c.png")})` }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
