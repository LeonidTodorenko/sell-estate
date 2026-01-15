using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RealEstateInvestment.Data;
using RealEstateInvestment.Models;
using RealEstateInvestment.Services;
using Resend;
using System.Reflection;
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
        ValidateAudience = false, //     todo дл€ прода 
                                  // ValidateIssuer = true,
                                  // ValidateAudience = true,
                                  // ValidIssuer = jwtIssuer,
                                  // ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
       // ValidIssuer = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero // без Ђплюс-5-минутї
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

// CORS (опционально; дл€ мобильного чаще всего можно AllowAnyOrigin)
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
        // test options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
//builder.Services.AddSwaggerGen(c =>
//{
//    c.SwaggerDoc("v1", new OpenApiInfo { Title = "SellEstate API", Version = "v1" });

//    // (A) ”стран€ем конфликты имЄн схем (классами с одинаковыми именами)
//    c.CustomSchemaIds(t => t.FullName?.Replace("+", "."));

//    // (B) XML-комментарии Ч только если файл реально существует
//    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
//    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
//    if (File.Exists(xmlPath))
//        c.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);

//    // (C) ≈сли вдруг есть конфликты по маршрутам Ч берЄм первый (чтобы не падало)
//   c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());

//    // (D) JWT в Swagger UI (чтобы потом 401/403 не мешал ручным вызовам)
//    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
//    {
//        Description = "JWT в заголовке: Bearer {token}",
//        Name = "Authorization",
//        In = ParameterLocation.Header,
//        Type = SecuritySchemeType.Http,
//        Scheme = "bearer",
//        BearerFormat = "JWT"
//    });
//    c.AddSecurityRequirement(new OpenApiSecurityRequirement
//    {
//        {
//            new OpenApiSecurityScheme
//            {
//                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
//            },
//            Array.Empty<string>()
//        }
//    });
//});
builder.Services.AddTransient<EmailService>();
builder.Services.AddSingleton<CaptchaService>();
builder.Services.AddScoped<ISuperUserService, SuperUserService>();
 
builder.Services.AddHttpClient();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<ICashFlowService, CashFlowService>();
builder.Services.AddScoped<IFirebaseNotificationService, FirebaseNotificationService>();
builder.Services.AddScoped<IModerationService, ModerationService>();
builder.Services.AddHostedService<ScheduledTaskService>();
builder.Services.AddScoped<IMonthlyReportService, MonthlyReportService>();
builder.Services.AddScoped<IAdminAuditReportService, AdminAuditReportService>();
builder.Services.AddScoped<IOnboardingDocumentService, OnboardingDocumentService>();
builder.Services.AddHostedService<MonthlyReportsHostedService>();
builder.Services.AddScoped<IKycContractService, KycContractService>();


var resendApiKey = builder.Configuration["Resend:ApiKey"];
if (string.IsNullOrWhiteSpace(resendApiKey))
{
    throw new InvalidOperationException("Resend:ApiKey is missing");
}
builder.Services.AddSingleton<IResend>(_ =>
{
    return ResendClient.Create(resendApiKey);
});
 


var app = builder.Build();

//app.UseCors();

// CORS
// todo test
//app.UseCors("Mobile");

app.UseDeveloperExceptionPage(); //todo remove after debug
//if (app.Environment.IsDevelopment())
//{
//    app.UseDeveloperExceptionPage();
 
//}

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ===== DEBUG: найти дубликаты маршрутов =====
//var ds = app.Services.GetRequiredService<EndpointDataSource>();
//var duplicates = ds.Endpoints
//    .OfType<RouteEndpoint>()
//    .Select(e => new
//    {
//        Route = e.RoutePattern.RawText,
//        Methods = e.Metadata.OfType<HttpMethodMetadata>().FirstOrDefault()?.HttpMethods ?? Array.Empty<string>(),
//        Action = e.Metadata.OfType<ControllerActionDescriptor>().FirstOrDefault()
//    })
//    .Where(x => x.Methods.Any() && x.Action != null)
//    .SelectMany(x => x.Methods.Select(m => new
//    {
//        Key = $"{m.ToUpper()} {x.Route}",
//        Where = $"{x.Action!.ControllerName}.{x.Action!.ActionName} ({x.Action!.DisplayName})"
//    }))
//    .GroupBy(x => x.Key)
//    .Where(g => g.Count() > 1)
//    .ToList();

//if (duplicates.Any())
//{
//    Console.ForegroundColor = ConsoleColor.Yellow;
//    Console.WriteLine("---- DUPLICATE ROUTES DETECTED ----");
//    foreach (var g in duplicates)
//    {
//        Console.WriteLine(g.Key);
//        foreach (var i in g)
//            Console.WriteLine($"  -> {i.Where}");
//    }
//    Console.ResetColor();
//}
// ===== END DEBUG =====

//using (var scope = app.Services.CreateScope())
//{
//    var superUserService = scope.ServiceProvider.GetRequiredService<ISuperUserService>();
//    await superUserService.EnsureSuperUserExistsAsync();
//}


// јвто-миграци€ и суперюзер
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

// »нициализаци€ системных настроек (как у теб€)
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
