# AWS Amplify Deployment Guide

## Prerequisites
- AWS Account with Amplify access
- GitHub repository (already set up: https://github.com/eyedwalker/Assistant.git)

## Step 1: Create Amplify App

1. Go to AWS Amplify Console: https://console.aws.amazon.com/amplify/
2. Click "New app" → "Host web app"
3. Choose "GitHub" as your repository service
4. Authorize AWS Amplify to access your GitHub account
5. Select repository: `eyedwalker/Assistant`
6. Select branch: `main`

## Step 2: Configure Build Settings

The `amplify.yml` file has been created with optimal Next.js 14 settings.

## Step 3: Environment Variables

Add these environment variables in Amplify Console under "Environment variables":

```bash
# MongoDB
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=ai_assistant

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name

# Anthropic AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# NextAuth
NEXTAUTH_URL=https://your-amplify-domain.amplifyapp.com
NEXTAUTH_SECRET=your_nextauth_secret

# Optional: Vimeo Integration
VIMEO_ACCESS_TOKEN=your_vimeo_token

# Optional: Google Shopping API
SERPAPI_KEY=your_serpapi_key
```

## Step 4: Advanced Settings

In Amplify Console, go to "Build settings" and configure:

1. **Build image settings**:
   - Build image: `Amazon Linux 2023`
   - Node.js version: `18`

2. **Build timeout**: 30 minutes (for large dependencies)

3. **Environment**:
   - Add custom environment variable: `NODE_OPTIONS=--max-old-space-size=4096`

## Step 5: Deploy

1. Click "Save and deploy"
2. Wait for the build to complete (first build may take 10-15 minutes)
3. Access your app at the provided Amplify URL

## Step 6: Custom Domain (Optional)

1. Go to "Domain management" in Amplify Console
2. Add your custom domain
3. Follow DNS configuration instructions

## Post-Deployment Checklist

- [ ] Verify MongoDB connection
- [ ] Test AI chat functionality
- [ ] Check document upload to S3
- [ ] Verify authentication flow
- [ ] Test API endpoints
- [ ] Check browser extension compatibility

## Troubleshooting

### Build Failures
- Check build logs in Amplify Console
- Ensure all environment variables are set
- Verify Node.js version compatibility

### Runtime Errors
- Check CloudWatch logs
- Verify MongoDB connection string format
- Ensure S3 bucket permissions are correct

### Performance Issues
- Enable Amplify Performance Mode
- Configure CloudFront caching
- Optimize Next.js image loading

## Security Considerations

1. **Environment Variables**: Never commit sensitive keys to git
2. **CORS**: Configure allowed origins in API routes
3. **Authentication**: Ensure NEXTAUTH_SECRET is strong
4. **S3**: Use IAM roles with minimal permissions
5. **MongoDB**: Use connection string with SSL enabled

## Monitoring

Set up CloudWatch alarms for:
- High error rates
- Slow response times
- Failed deployments
- High memory usage

## Support

For issues specific to this application:
- Check the README.md for application-specific setup
- Review the .env.example for required variables
- Test locally first with `npm run dev`
