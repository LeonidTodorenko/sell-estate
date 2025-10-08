using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Resend;
using System.Text;
using System.Text.Json.Serialization;


var builder = WebApplication.CreateBuilder(args);

// PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT
var jwtKey = builder.Configuration["Jwt:Key"] ?? "super-secret-development-key";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SellEstateIssuer";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "SellEstateClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // todo надо будет включить потом на проде, проверить
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false, //     todo для прода 
                                  // ValidateIssuer = true,
                                  // ValidateAudience = true,
                                  // ValidIssuer = jwtIssuer,
                                  // ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
       // ValidIssuer = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero // без «плюс-5-минут»
    };
});

// todo allow some origin - for test allowed all
//builder.Services.AddCors(options =>
//{
//    options.AddDefaultPolicy(policy =>
//    {
//        policy.AllowAnyOrigin()     
//              .AllowAnyHeader()
//              .AllowAnyMethod();
//    });
//});

// CORS (опционально; для мобильного чаще всего можно AllowAnyOrigin)
// todo проверить
//builder.Services.AddCors(options =>
//{
//    options.AddPolicy("Mobile", policy =>
//        policy.AllowAnyOrigin()
//              .AllowAnyHeader()
//              .AllowAnyMethod());
//});


builder.Services.AddAuthorization();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddTransient<EmailService>();
builder.Services.AddSingleton<CaptchaService>();
builder.Services.AddScoped<ISuperUserService, SuperUserService>();
 
builder.Services.AddHttpClient();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<IFirebaseNotificationService, FirebaseNotificationService>();
builder.Services.AddHostedService<ScheduledTaskService>();


var resendApiKey = builder.Configuration["Resend:ApiKey"];
if (string.IsNullOrWhiteSpace(resendApiKey))
{
    throw new InvalidOperationException("Resend:ApiKey is missing");
}
builder.Services.AddSingleton<IResend>(_ =>
{
    return ResendClient.Create(resendApiKey);
});
builder.Services.AddScoped<EmailService>();


var app = builder.Build();

//app.UseCors();

// CORS
// todo test
//app.UseCors("Mobile");

app.UseDeveloperExceptionPage(); //todo remove after debug
//if (app.Environment.IsDevelopment())
//{
//    app.UseDeveloperExceptionPage();
//    app.UseSwagger();
//    app.UseSwaggerUI();
//}

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

//using (var scope = app.Services.CreateScope())
//{
//    var superUserService = scope.ServiceProvider.GetRequiredService<ISuperUserService>();
//    await superUserService.EnsureSuperUserExistsAsync();
//}


// Авто-миграция и суперюзер
using (var scope = app.Services.CreateScope())
{
    var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
   
    var runMigrations = cfg.GetValue<bool>("RunMigrationsOnStartup"); // false на стенде
    if (runMigrations)
    {
      context.Database.Migrate();
    }

    var superUserService = scope.ServiceProvider.GetRequiredService<ISuperUserService>();
    await superUserService.EnsureSuperUserExistsAsync();
}

// Инициализация системных настроек (как у тебя)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (!context.SystemSettings.Any(s => s.Key == "CancelListingFee"))
    {
        context.SystemSettings.Add(new SystemSetting
        {
            Key = "CancelListingFee",
            Value = "10" // default
        });
        context.SaveChanges();
    }
}

app.Run();
