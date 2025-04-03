# Используем официальный образ .NET SDK для сборки
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Копируем всё и собираем
COPY . .
RUN dotnet publish RealEstateInvestment/RealEstateInvestment.csproj -c Release -o out

# Финальный образ: только рантайм
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/out .

ENTRYPOINT ["dotnet", "RealEstateInvestment.dll"]
