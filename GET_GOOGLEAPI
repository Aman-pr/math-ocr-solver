# How to Obtain a Google Generative AI API Key

To use the Google Generative AI services in your project, you need an API key. Follow the steps below to get your API key.

## Free Version Eligibility
Google offers free-tier usage for its APIs, which may include free requests or credits. Be sure to review the [Google Cloud Free Tier Documentation](https://cloud.google.com/free) to understand any limitations and ensure your project stays within the free usage limits.

## Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the **Select a Project** dropdown at the top of the page.
3. Select **New Project** and fill in the following:
   - **Project Name:** Enter a name for your project.
   - **Organization:** Choose your organization if applicable.
4. Click **Create** and wait for the project to be created.

## Step 2: Enable the Google Generative AI API
1. With your project selected, go to the [Google API Library](https://console.cloud.google.com/apis/library).
2. Search for **Google Generative AI API** in the search bar.
3. Select the API and click **Enable**.

## Step 3: Set Up API Credentials
1. Navigate to the [Credentials](https://console.cloud.google.com/apis/credentials) page.
2. Click **Create Credentials** > **API Key**.
3. Copy the generated API key and store it securely. You’ll use this key in your application.

## Step 4: Restrict the API Key (Optional, but Recommended)
1. In the **Credentials** page, locate your API key and click the pencil icon to edit.
2. Under **Key Restrictions**, choose one of the following options:
   - **IP Address Restrictions:** Only allow specific IPs to use this key.
   - **HTTP Referrer Restrictions:** Only allow specific domains or apps.
   - **API Restrictions:** Restrict the key to only the Generative AI API.
3. Save your changes.

## Step 5: Test Your API Key
1. Open a terminal or code editor.
2. Use a library like `requests` or `curl` to send a test API request to ensure the key works properly.

## Step 6: Use the API Key in Your Project
Add the API key to your project:
```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
```

## Tips for Free Tier Usage
- Regularly monitor your usage in the [Google Cloud Console](https://console.cloud.google.com/).
- Set budget alerts to avoid exceeding the free tier.
- Leverage the free-tier credits for new accounts (usually $300 for 90 days).

## Troubleshooting
- If you encounter issues, check the **IAM & Admin** section in the Google Cloud Console to ensure your account has proper permissions.
- Verify that the Generative AI API is enabled in the correct project.

For more details, consult the [Google Generative AI API Documentation](https://cloud.google.com/generative-ai/).
