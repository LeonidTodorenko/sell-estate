using Microsoft.AspNetCore.Mvc;
using System;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/payments")]
    public class PaymentController : ControllerBase
    {
        [HttpPost("simulate-payment")]
        public IActionResult SimulatePayment([FromBody] decimal amount)
        {
            return Ok(new
            {
                message = "Payment was successful",
                transactionId = Guid.NewGuid()
            });
        }
    }
}
