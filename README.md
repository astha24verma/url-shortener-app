# URL Shortener API

## Overview

This project implements a scalable URL Shortener API that includes user authentication via Google Sign-In, advanced analytics, and rate limiting. The solution allows users to create short URLs for long and complex URLs, categorize them under specific topics, and track detailed analytics for individual and grouped URLs.

## Features

- User Authentication with Google Sign-In
- Custom URL shortening with optional aliases
- Topic-based URL grouping
- Comprehensive analytics tracking
  - Total and unique clicks
  - OS and device type statistics
  - Time-based analytics
  - Topic-based grouping analytics
- Rate limiting
- Redis caching for improved performance
- Docker containerization
- API documentation with Swagger

## Tech Stack

- Node.js
- MongoDB (Database)
- Redis (Caching)
- Docker
- Express.js
- Google Auth Library
- JWT for authentication
- Swagger for API documentation

## Prerequisites

- Node.js
- Docker and Docker Compose
- MongoDB
- Redis
- Google OAuth credentials

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/url-shortener-api.git
cd url-shortener-api
```

2. Create a `.env` file with the following variables:

```
MONGODB_URI=mongodb://localhost:27017/urlshortener
REDIS_URL=redis://localhost:6379
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=your_jwt_secret
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

3. Run with Docker:

```bash
docker-compose up -d
```

Or run locally:

```bash
npm install
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/google` - Google Sign-In authentication

### URL Operations

- `POST /api/shorten` - Create short URL
- `GET /api/{alias}` - Redirect to original URL

### Analytics

- `GET /api/analytics/{alias}` - Get analytics for specific URL
- `GET /api/analytics/topic/{topic}` - Get topic-based analytics
- `GET /api/analytics/overall` - Get overall analytics

## API Documentation

Access the Swagger documentation at `/api-docs` when running the server.

## Testing

Run the test suite:

```bash
npm test
```

## Project Structure

```
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
├── tests/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- 10 requests per 15-minute window per user
- Separate limits for URL creation and analytics endpoints

## Caching Strategy

- Redis caches frequently accessed URLs
- Analytics data cached with customizable TTL
- Cache invalidation on URL updates

## Deployment

The application can be deployed to any cloud platform that supports Docker containers. Current deployment URL: https://url-shortener-app-0uge.onrender.com

## Future Improvements

- Implement URL expiration
- Add custom domain support
- Enhanced analytics visualization
- Bulk URL creation
- API key management for enterprise users

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
