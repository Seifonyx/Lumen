# My Chat

A small private chat app for Gemini (Google AI Studio) and OpenRouter models, with file uploads
(PDF, Word .docx, images, text files). Runs free on Vercel.

## Deploy on Vercel

1. In Vercel: **Add New → Project**, import this GitHub repository, and click **Deploy**
   (no build settings needed).
2. In the project: **Settings → Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `APP_PASSWORD` | the password you'll type to open the app |
   | `GEMINI_API_KEY` | your key from aistudio.google.com |
   | `OPENROUTER_API_KEY` | your `sk-or-...` key from openrouter.ai |
   | `GEMINI_MODELS` | optional, comma-separated, e.g. `gemini-3.5-flash,gemini-flash-lite-latest,gemma-4-31b-it` |
   | `OPENROUTER_MODELS` | optional, comma-separated, e.g. `nvidia/nemotron-3-super-120b-a12b:free` |

3. **Deployments → ⋯ → Redeploy** once after saving the variables.

Model names: copy them exactly from Google AI Studio's model list (without `models/`) and from
openrouter.ai/models. A provider only shows up if its key is set.

## Files

- PDFs up to 2.5 MB are sent as-is (the model reads text and pictures). Bigger PDFs are converted
  to text in the browser first; scanned PDFs that big need to be sent as screenshots.
- Word (.docx) and text files are converted to text in the browser.
- Images are resized to 1600 px before sending.
- Vercel limits each request to about 4.5 MB. In long chats with many files, the oldest files are
  dropped from what's sent so new messages still go through.

Chats are saved in the browser on each device (not on the server).

## Privacy

Free tiers may use your conversations to improve the providers' models. Don't send patient data
or other confidential information.
