# Use the official Microsoft Playwright Python image as the base
FROM mcr.microsoft.com/playwright/python:v1.62.0-noble

# Set the working directory inside the container
WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY backend/ .

# Expose port and run server
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]