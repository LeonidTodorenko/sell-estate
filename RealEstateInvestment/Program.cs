using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Data;
using RealEstateInvestment.Services;

var builder = WebApplication.CreateBuilder(args);

// PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddTransient<EmailService>();
builder.Services.AddSingleton<CaptchaService>();
// todo test builder.Services.AddHostedService<ScheduledTaskService>();

var app = builder.Build();

//app.UseCors();

app.UseDeveloperExceptionPage(); //todo remove after debug
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();



app.Run();
