using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Models;
using System;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/payments")]
    public class PaymentController : ControllerBase
    {
        [HttpPost("simulate-payment")]
        public IActionResult SimulatePayment([FromBody] decimal amount)
        {
            return StatusCode(410, new { message = "Use /api/payments to create a verified wallet payment." });
        }
    }
}
