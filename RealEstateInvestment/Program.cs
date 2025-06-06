using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RealEstateInvestment.Data;
using RealEstateInvestment.Services;
using System.Text;
 

var builder = WebApplication.CreateBuilder(args);

// PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtKey = builder.Configuration["Jwt:Key"] ?? "super-secret-development-key";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SellEstateIssuer";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // отключи на проде
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false, //     ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
       // ValidIssuer = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
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

builder.Services.AddAuthorization();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.WriteIndented = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddTransient<EmailService>();
builder.Services.AddSingleton<CaptchaService>();
builder.Services.AddScoped<ISuperUserService, SuperUserService>();
// todo test
builder.Services.AddHttpClient();
builder.Services.AddHostedService<ScheduledTaskService>();

var app = builder.Build();

//app.UseCors();

app.UseDeveloperExceptionPage(); //todo remove after debug
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseAuthorization();
app.UseAuthorization();

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var superUserService = scope.ServiceProvider.GetRequiredService<ISuperUserService>();
    await superUserService.EnsureSuperUserExistsAsync();
}

app.Run();
