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
            // todo
            //_context.ActionLogs.Add(new ActionLog
            //{
            //    UserId = new Guid("2273adeb-483c-4104-a3a9-585b3dad9e27"), // todo add admin guid later
            //    Action = "SimulatePayment",
            //    Details = "SimulatePayment"  
            //});
            return Ok(new
            {
                message = "Payment was successful",
                transactionId = Guid.NewGuid()
            });
        }
    }
}
