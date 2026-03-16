# Troubleshooting Guide

## Backend Connection Issues

**Symptom:** Pages show empty state or demo data

**Fix:**
1. Ensure backend is running: `npm run dev` in XPS_INTELLIGENCE_SYSTEM
2. Check `VITE_API_URL` in `.env` matches backend port
3. Check browser console for CORS errors
4. Verify firewall/proxy settings

## Build Errors

**TypeScript errors:**
```bash
npx tsc --noEmit
```
Fix any type errors reported.

**Missing dependencies:**
```bash
npm install
```

## Agent Not Responding

1. Check Logs page for recent errors
2. Verify API keys in Settings > Token Vault
3. Restart agent from Settings > Agent Configuration

## Scraper Failures

1. Check proxy configuration in Settings
2. Verify target sites are accessible
3. Review scraper logs in System Logs page
4. Reduce concurrent scrapers if rate limited

## Performance Issues

1. Reduce max parallel agents in Settings
2. Clear browser cache
3. Check system resources in Sandbox > System Monitor
4. Review Docker container health

## Data Not Appearing

After scraping, data should auto-appear in Contractors page.
If not:
1. Verify scrape job completed successfully
2. Check database connection in backend logs
3. Refresh the Contractors page manually
